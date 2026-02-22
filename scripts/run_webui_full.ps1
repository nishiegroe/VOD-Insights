$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$env:PATH = "C:\Program Files\Tesseract-OCR;$env:PATH"
$env:APEX_WEBUI_WATCH = "0"

Push-Location "$root\frontend"
if (-not (Test-Path "node_modules")) {
	Write-Host "Installing frontend dependencies..."
	npm install
}
Write-Host "Building frontend..."
npm run build
$buildExit = $LASTEXITCODE
if ($buildExit -ne 0) {
	Write-Host "Frontend build failed."
	Read-Host "Press Enter to close"
	return
}
Pop-Location

do {
	Write-Host "Starting Flask web UI..."
	Push-Location $root
	& "$root\.venv\Scripts\python.exe" -m app.webui
	$exitCode = $LASTEXITCODE
	Pop-Location
} while ($exitCode -eq 3)

if ($exitCode -ne 0) {
	Write-Host "Web UI exited with code $exitCode."
	Read-Host "Press Enter to close"
}

Read-Host "Press Enter to close"
