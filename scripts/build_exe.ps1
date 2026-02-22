$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path "frontend\\node_modules")) {
    Write-Host "Installing frontend dependencies..."
    Set-Location "frontend"
    npm install
    Set-Location ..
}

Write-Host "Building frontend..."
Set-Location "frontend"
npm run build
Set-Location ..

Write-Host "Collecting third-party licenses..."
& (Join-Path (Get-Location) "scripts\copy_third_party_licenses.ps1")

Write-Host "Building EXE (PyInstaller)..."
Write-Host "Ensuring ffmpeg.exe is available in tools..."
$toolsDir = Join-Path (Get-Location) "tools"
$ffmpegExe = Join-Path $toolsDir "ffmpeg.exe"
if (-not (Test-Path $ffmpegExe)) {
    $ffmpegZip = Join-Path $toolsDir "ffmpeg.zip"
    if (Test-Path $ffmpegZip) {
        $ffmpegUnpack = Join-Path $toolsDir "ffmpeg"
        if (-not (Test-Path $ffmpegUnpack)) {
            Expand-Archive -Path $ffmpegZip -DestinationPath $ffmpegUnpack -Force
        }
    }
    $ffmpegCandidate = Get-ChildItem -Path $toolsDir -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
    if ($ffmpegCandidate) {
        Copy-Item $ffmpegCandidate.FullName $ffmpegExe -Force
        Write-Host "Copied ffmpeg.exe to $ffmpegExe"
    } else {
        Write-Host "Warning: ffmpeg.exe not found to copy into tools."
    }
}
if (Test-Path "build") {
    Remove-Item -Recurse -Force "build"
}
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}
$venvPython = Join-Path (Get-Location) ".venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    $prevPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $venvPython -m pip show PyInstaller 2>$null | Out-Null
    $pipShowExit = $LASTEXITCODE
    $ErrorActionPreference = $prevPreference
    if ($pipShowExit -ne 0) {
        Write-Host "Installing PyInstaller in venv..."
        & $venvPython -m pip install PyInstaller
    }
    & $venvPython -m PyInstaller apex_event_tracker.spec
} else {
    python -m PyInstaller apex_event_tracker.spec
}
$backendExeDir = Join-Path (Get-Location) "dist\ApexEventTracker\ApexEventTracker.exe"
$backendExeLegacy = Join-Path (Get-Location) "dist\ApexEventTracker.exe"
if (Test-Path $backendExeDir) {
    Write-Host "Backend EXE built at $backendExeDir"
} elseif (Test-Path $backendExeLegacy) {
    Write-Host "Backend EXE built at legacy path $backendExeLegacy"
} else {
    throw "Backend EXE not found at $backendExeDir (or legacy $backendExeLegacy). PyInstaller build may have failed."
}
