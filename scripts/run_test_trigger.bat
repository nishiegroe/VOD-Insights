@echo off
setlocal
set "ROOT=%~dp0.."
set "PATH=C:\Program Files\Tesseract-OCR;%PATH%"
"%ROOT%\.venv\Scripts\python.exe" -m app.main --test-trigger
endlocal
