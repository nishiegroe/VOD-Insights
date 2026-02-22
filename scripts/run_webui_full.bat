@echo off
setlocal
set "ROOT=%~dp0.."
set "PATH=C:\Program Files\Tesseract-OCR;%PATH%"
set "APEX_WEBUI_WATCH=0"

pushd "%ROOT%\frontend"
if not exist node_modules (
  echo Installing frontend dependencies...
  call npm install
  if errorlevel 1 goto done
)

echo Building frontend...
call npm run build
set "BUILD_EXIT=%ERRORLEVEL%"
if %BUILD_EXIT% NEQ 0 (
  echo Frontend build failed.
  goto done
)
popd

:restart
echo Starting Flask web UI...
cd /d "%ROOT%"
"%ROOT%\.venv\Scripts\python.exe" -m app.webui
if %ERRORLEVEL%==3 goto restart
if %ERRORLEVEL% NEQ 0 (
  echo Web UI exited with code %ERRORLEVEL%.
)

:done
pause
endlocal
