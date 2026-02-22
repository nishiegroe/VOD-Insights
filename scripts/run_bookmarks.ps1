$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$env:PATH = "C:\Program Files\Tesseract-OCR;$env:PATH"
& "$root\.venv\Scripts\python.exe" -m app.bookmark_main
