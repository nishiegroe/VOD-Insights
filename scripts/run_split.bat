@echo off
setlocal
set "ROOT=%~dp0.."
"%ROOT%\.venv\Scripts\python.exe" -m app.split_bookmarks
endlocal
