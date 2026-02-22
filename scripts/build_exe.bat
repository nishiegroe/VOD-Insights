@echo off
setlocal

cd /d %~dp0\..

if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  cd frontend
  call npm install
  cd ..
)

echo Building frontend...
cd frontend
call npm run build
cd ..

echo Collecting third-party licenses...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\copy_third_party_licenses.ps1"

echo Building EXE (PyInstaller)...
echo Ensuring ffmpeg.exe is available in tools...
set "TOOLS_DIR=tools"
if not exist "%TOOLS_DIR%\ffmpeg.exe" (
  if exist "%TOOLS_DIR%\ffmpeg.zip" (
    powershell -NoProfile -Command "Expand-Archive -Path '%TOOLS_DIR%\ffmpeg.zip' -DestinationPath '%TOOLS_DIR%\ffmpeg' -Force"
  )
  for /f "delims=" %%F in ('dir /b /s "%TOOLS_DIR%\ffmpeg.exe"') do (
    copy /y "%%F" "%TOOLS_DIR%\ffmpeg.exe" >nul
    goto :ffmpeg_done
  )
)
:ffmpeg_done
python -m PyInstaller apex_event_tracker.spec

endlocal
