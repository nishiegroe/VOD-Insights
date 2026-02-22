$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$env:PATH = "C:\Program Files\Tesseract-OCR;$env:PATH"
$env:APEX_WEBUI_WATCH = "1"
do {
	& "$root\.venv\Scripts\python.exe" -m app.webui
	$exitCode = $LASTEXITCODE
} while ($exitCode -eq 3)
