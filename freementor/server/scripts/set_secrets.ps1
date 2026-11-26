# Stores the server's secret keys in Google Secret Manager.
#
# Run it yourself in PowerShell. Each value is typed at a hidden prompt, goes
# straight to Google, and never lands in git, the chat or your shell history.
#
#   powershell -ExecutionPolicy Bypass -File freementor\server\scripts\set_secrets.ps1
#
# Running it again adds a new version of a secret (the deploy uses :latest).

$ErrorActionPreference = 'Stop'
$gcloud = 'gcloud.cmd'
$secrets = 'DATABASE_URL', 'SUPABASE_JWT_SECRET', 'SUPABASE_SERVICE_KEY', 'SMTP_PASSWORD'

$project = (& $gcloud config get-value project).Trim()
$number = (& $gcloud projects describe $project --format='value(projectNumber)').Trim()
$runner = "serviceAccount:$number-compute@developer.gserviceaccount.com"
$existing = & $gcloud secrets list --format='value(name)'

foreach ($name in $secrets) {
  $secure = Read-Host -Prompt "Paste $name (hidden), then Enter" -AsSecureString
  $plain = [System.Net.NetworkCredential]::new('', $secure).Password.Trim()
  if (-not $plain) { Write-Host "  skipped $name (empty)"; continue }

  # Written without a BOM or trailing newline: either would corrupt the value.
  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    [System.IO.File]::WriteAllText($tmp, $plain, (New-Object System.Text.UTF8Encoding $false))
    if ($existing -contains $name) {
      & $gcloud secrets versions add $name --data-file=$tmp | Out-Null
    } else {
      & $gcloud secrets create $name --replication-policy=automatic --data-file=$tmp | Out-Null
    }
  } finally {
    Remove-Item $tmp -Force
  }
  & $gcloud secrets add-iam-policy-binding $name --member=$runner `
    --role='roles/secretmanager.secretAccessor' --condition=None | Out-Null
  Write-Host "  saved $name"
}
Write-Host 'Done. Tell Claude "secrets done".'
