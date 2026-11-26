# Deploying the API to Google Cloud Run (free-tier friendly)

Cloud Run scales to zero, so you pay nothing while nobody is using the app, and
a small launch should sit inside the free tier (check Google's current limits).
It needs a billing account with a card on file; the steps below cap the cost.

Run every command from the **repository root** unless it says otherwise. You
need the [gcloud CLI](https://cloud.google.com/sdk/docs/install) signed in as
the Google account that owns your Cloud project.

## 0. One-time setup

```powershell
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create freementor --repository-format=docker --location=asia-south1
```

**Set a budget alert first:** Google Cloud console -> Billing -> Budgets & alerts
-> create a budget of ₹100 with an email alert at 50% and 100%. An alert does not
stop spending by itself; the `--max-instances 2` below is what caps it.

## 1. Put the secrets in Secret Manager

Never in the image, never in git. Create each from a prompt so the value does
not land in your shell history:

```powershell
$secrets = "DATABASE_URL","SUPABASE_JWT_SECRET","SUPABASE_SERVICE_KEY","SMTP_PASSWORD","FIREBASE_SERVICE_ACCOUNT_JSON","GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"
foreach ($s in $secrets) {
  $v = Read-Host -Prompt "Value for $s" -AsSecureString
  $plain = [System.Net.NetworkCredential]::new("", $v).Password
  $plain | gcloud secrets create $s --data-file=-
}
```

| Secret | Where it comes from |
|---|---|
| `DATABASE_URL` | Supabase -> Project settings -> Database -> Connection string, **Session pooler** (`aws-0-<region>.pooler.supabase.com:5432`, user `postgres.<ref>`). The direct host is IPv6-only and fails on Cloud Run. |
| `SUPABASE_JWT_SECRET` | Supabase -> Project settings -> API -> JWT secret |
| `SUPABASE_SERVICE_KEY` | Supabase -> Project settings -> API -> service_role key |
| `SMTP_PASSWORD` | A Gmail **app password** (Google account -> Security -> 2-Step Verification -> App passwords) or your Brevo SMTP key |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase -> Project settings -> Service accounts -> Generate new private key; paste the whole JSON |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | The key of the service account you invite in Play Console -> Users and permissions (with "View financial data" and "Manage orders"). Until it exists, purchases return 503 and everything else works. |

Let Cloud Run read them:

```powershell
$project = gcloud config get-value project
$number = gcloud projects describe $project --format="value(projectNumber)"
foreach ($s in $secrets) {
  gcloud secrets add-iam-policy-binding $s --member="serviceAccount:$number-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
}
```

## 2. Build the image

```powershell
gcloud builds submit --config freementor/server/cloudbuild.yaml .
```

## 3. Deploy

Create `cloudrun.env.yaml` next to this file (it holds no secrets, but keep it
out of git anyway; it is ignored). Fill in your values:

```yaml
SUPABASE_URL: "https://YOUR_REF.supabase.co"
SUPABASE_PUBLISHABLE_KEY: "sb_publishable_..."
OTP_ECHO: "false"
EXPOSE_API_DOCS: "false"
FORWARDED_ALLOW_IPS: "*"
SMTP_HOST: "smtp.gmail.com"
SMTP_PORT: "587"
SMTP_USER: "you@gmail.com"
SMTP_FROM: "FreeMentor <you@gmail.com>"
FIREBASE_PROJECT_ID: "freementor-6a923"
ADMIN_EMAILS: "you@gmail.com"
```

`FORWARDED_ALLOW_IPS: "*"` is safe here because Cloud Run containers can only be
reached through Google's own front end; it is what lets the rate limiter see
each learner's real address instead of Google's.

```powershell
gcloud run deploy freementor-api `
  --image asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/freementor/api:latest `
  --region asia-south1 `
  --allow-unauthenticated `
  --min-instances 0 --max-instances 2 `
  --memory 512Mi --cpu 1 `
  --env-vars-file freementor/server/cloudrun.env.yaml `
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,SUPABASE_JWT_SECRET=SUPABASE_JWT_SECRET:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest,SMTP_PASSWORD=SMTP_PASSWORD:latest,FIREBASE_SERVICE_ACCOUNT_JSON=FIREBASE_SERVICE_ACCOUNT_JSON:latest,GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:latest"
```

The server **refuses to start** in production if a required secret or SMTP
setting is missing, or if `OTP_ECHO` is on. If the deploy fails, read the
revision's logs; the error message says exactly which setting is absent.

## 4. Check it

Use the URL the deploy prints:

```powershell
curl https://YOUR-SERVICE-URL/health
curl https://YOUR-SERVICE-URL/health/db
```

`/health` must show `"environment": "production"`, `"verifies_real_tokens": true`
and `"otp_echo": false`. `/health/db` must return `{"status":"ok"}`. The first
request after a quiet period takes a few seconds (a cold start); that is normal.

## 5. Point the app at it

The app only syncs once it knows the address. In EAS (and your `.env` for Expo
Go), set `EXPO_PUBLIC_API_URL` to the service URL:

```powershell
npx.cmd eas-cli env:create --name EXPO_PUBLIC_API_URL --value https://YOUR-SERVICE-URL --visibility plaintext --environment production --environment preview --environment development
```

## 6. Keep the free Supabase database awake

Supabase's free tier pauses after about a week of no database activity. The
workflow `.github/workflows/keepalive.yml` pings `/health/db` every three days.
Add a repository **variable** (not a secret) in GitHub -> Settings -> Secrets
and variables -> Actions -> Variables: `API_URL` = your service URL.

## 7. Back up the database monthly

The free tier has no automatic backups, and `purchases` holds records the
privacy policy promises to keep for 8 years. With `DATABASE_URL` set (a `.env`
file in `freementor/server/` is enough locally):

```powershell
cd freementor/server
.venv/Scripts/python -m app.scripts.export_data
```

That writes `backups/freementor-<date>.json`. It is git-ignored and contains
personal data: keep it in a private place (an encrypted drive or a private cloud
folder), never in the repo or a public link. Upgrade to Supabase Pro (about
₹2,100 a month) once you have paying users; it adds daily backups.

## Rollback

Cloud Run keeps every revision. To go back: Google Cloud console -> Cloud Run ->
freementor-api -> Revisions -> select the previous one -> Manage traffic -> 100%.
