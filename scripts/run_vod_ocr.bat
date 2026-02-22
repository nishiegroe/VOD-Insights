@echo off
set VOD_PATH=%~1
if "%VOD_PATH%"=="" (
  set /p VOD_PATH=Enter full path to VOD file: 
)
if "%VOD_PATH%"=="" (
  echo No VOD path provided.
  exit /b 1
)
".venv\Scripts\python.exe" -m app.vod_ocr --vod "%VOD_PATH%"
