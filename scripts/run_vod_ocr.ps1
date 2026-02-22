param(
  [string]$VodPath = ""
)

$ErrorActionPreference = "Stop"

if (-not $VodPath) {
  $VodPath = Read-Host "Enter full path to VOD file"
}

if (-not $VodPath) {
  Write-Host "No VOD path provided."
  exit 1
}

& ".venv\Scripts\python.exe" -m app.vod_ocr --vod "$VodPath"
