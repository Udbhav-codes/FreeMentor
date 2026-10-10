# Google sign-in — setup guide

Everything here is done in two consoles: **Google Cloud** and **Supabase**.
No code changes are needed to complete these steps; the app side is wired up
afterwards and is noted at the end.

Values you will need, already fixed by this project:

| | |
|---|---|
| Supabase project | `demkvsslqfkreicbjjmm` |
| Supabase URL | `https://demkvsslqfkreicbjjmm.supabase.co` |
| **Authorised redirect URI** | `https://demkvsslqfkreicbjjmm.supabase.co/auth/v1/callback` |
| Android package | `com.freementor.app` |
| App deep-link scheme | `freementor://` |

Current state: Google is **not enabled** (`external.google: false`); only
email is. Sign-ups are allowed.

---

## Why there are two OAuth clients

This is the part that catches people out, so it is worth understanding before
clicking anything.

Android Google sign-in uses **two** client IDs at once:

- an **Android** client, which identifies your app by its package name and
  the SHA-1 of the certificate it was signed with. It has no secret.
- a **Web** client, whose ID is the *audience* of the ID token Google issues,
  and whose secret Supabase uses to complete the exchange.

You tell Google about the Android client; you give the **Web** client's ID and
secret to Supabase. Handing Supabase the Android client ID instead is the most
common failure, and it presents as `invalid_client` with nothing useful in the
message.

---

## 1. Google Cloud — create the project and consent screen

1. <https://console.cloud.google.com> → **New Project** → name it `FreeMentor`.
2. **APIs & Services → OAuth consent screen**:
   - User type **External**
   - App name `FreeMentor`, your support email, developer contact
   - Scopes: `email`, `profile`, `openid` — nothing more. Asking for more than
     you use slows verification and contradicts the minimum-collection promise
     in product plan §15.
   - **Publishing status**: while it is *Testing*, only accounts listed under
     **Test users** can sign in — including yours. Add every closed-test
     tester here, or publish the app before the Play closed test starts.

## 2. Google Cloud — the Web client

**APIs & Services → Credentials → Create credentials → OAuth client ID**

- Application type: **Web application**
- Name: `FreeMentor web (Supabase)`
- **Authorised redirect URIs** — exactly this, no trailing slash:

```
https://demkvsslqfkreicbjjmm.supabase.co/auth/v1/callback
```

Keep the **Client ID** and **Client secret**. Both go to Supabase.

## 3. Google Cloud — the Android client

**Create credentials → OAuth client ID → Android**

- Package name: `com.freementor.app`
- SHA-1 certificate fingerprint: see below

There is no secret for this one, and nothing from it goes into Supabase. Its
job is to let Google accept requests from *this* app.

### Getting the SHA-1 — and why there is more than one

A build is accepted only if its signing certificate matches a fingerprint
registered here. Different builds are signed differently, so each needs its
own entry:

| Build | Where its SHA-1 comes from |
|---|---|
| EAS development/preview | `eas credentials` → Android → the keystore EAS generated |
| Play production | Play Console → **Setup → App signing** → *App signing key certificate* |

Register **all** of them. Sign-in silently failing in the Play build while
working perfectly in your dev build is almost always the production key's
fingerprint missing — Google Play re-signs your upload with its own key, so
the fingerprint you used for development is not the one the installed app
carries.

```bash
cd freementor/app
npx eas credentials      # Android -> shows the SHA-1 for each profile
```

## 4. Supabase — enable the provider

Dashboard → **Authentication → Providers → Google**:

- Toggle **Enable Sign in with Google**
- **Client ID**: the **Web** client ID from step 2 *(not the Android one)*
- **Client Secret**: the Web client secret
- Save

Then **Authentication → URL Configuration → Redirect URLs**, add:

```
freementor://auth/callback
com.freementor.app://auth/callback
```

Without these, Supabase refuses to hand the session back to the app and the
browser just sits on a blank page.

## 5. Check it

```bash
curl -s https://demkvsslqfkreicbjjmm.supabase.co/auth/v1/settings \
  -H "apikey: sb_publishable_npXHgnLqTnC2LyEfH3UxoQ_5m9u8S66"
```

`external.google` should now be `true`. It is `false` today.

---

## Which sign-in flow the app uses

Two options, and the choice matters for testing:

**Native (`@react-native-google-signin/google-signin`)** — the one-tap Android
account sheet, which is what learners expect. It returns an ID token that goes
to `supabase.auth.signInWithIdToken()`. **It does not work in Expo Go**: it
needs native code, so a development build is required.

**Web OAuth (`signInWithOAuth`)** — opens a browser, comes back on the deep
link. Works in Expo Go, so it is useful now, but it is a visibly worse
experience.

The plan is native for release, with the web flow retained as a fallback for
Expo Go. Both need the setup above; native additionally needs the Android
client from step 3 and the Web client ID passed as `webClientId`.

---

## What changes in the code afterwards

For reference — none of this blocks the console work:

- `app/src/api/sync.ts` — `authToken()` returns the Supabase session token
  instead of `EXPO_PUBLIC_DEV_TOKEN`
- a sign-in screen before the age gate (product plan §5 step 2)
- `server/.env` — `OTP_ECHO=false` once a real sender exists
- the server's local stub token path stops being used; `verifies_real_tokens`
  stays `true`

## If it does not work

| Symptom | Cause |
|---|---|
| `invalid_client` | Supabase was given the **Android** client ID. It needs the **Web** one. |
| `redirect_uri_mismatch` | The URI in step 2 does not match exactly — check for a trailing slash. |
| Works in dev, fails in the Play build | The Play **app signing** SHA-1 is not registered (step 3). |
| Browser returns to a blank screen | The deep link is missing from **Redirect URLs** (step 4). |
| `access_blocked` for a tester | Consent screen is still *Testing* and they are not a listed test user. |
