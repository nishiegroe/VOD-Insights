@echo off
setlocal

cd /d %~dp0\..

powershell -NoProfile -ExecutionPolicy Bypass -File "%cd%\scripts\download_tools.ps1"

endlocal
