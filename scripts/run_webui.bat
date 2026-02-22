@echo off
setlocal
set "ROOT=%~dp0.."
set "PATH=C:\Program Files\Tesseract-OCR;%PATH%"
set "APEX_WEBUI_WATCH=1"
:restart
"%ROOT%\.venv\Scripts\python.exe" -m app.webui
if %ERRORLEVEL%==3 goto restart
endlocal
