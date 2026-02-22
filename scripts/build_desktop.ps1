param(
    [ValidateSet("nsis", "portable")]
    [string]$Target = "portable"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..."
    Push-Location "frontend"
    npm install
    Pop-Location
}

Write-Host "Building frontend..."
Push-Location "frontend"
npm run build
Pop-Location

Write-Host "Collecting third-party licenses..."
& (Join-Path $root "scripts\copy_third_party_licenses.ps1")

Write-Host "Building backend EXE (PyInstaller)..."
if (Test-Path "build") {
    Remove-Item -Recurse -Force "build"
}
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}
$venvPython = Join-Path $root ".venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    $enableGpuOcr = $false
    if ($env:ENABLE_GPU_OCR_BUNDLE) {
        $enableGpuOcr = $env:ENABLE_GPU_OCR_BUNDLE.ToLower() -in @("1", "true", "yes", "on")
    }
    if ($enableGpuOcr) {
        Write-Host "Installing GPU OCR dependencies (EasyOCR + CUDA torch)..."
        $torchIndexUrl = $env:TORCH_CUDA_INDEX_URL
        if (-not $torchIndexUrl) {
            $torchIndexUrl = "https://download.pytorch.org/whl/cu121"
        }
        & $venvPython -m pip install easyocr
        & $venvPython -m pip install torch torchvision torchaudio --index-url $torchIndexUrl
        Write-Host "Pre-downloading EasyOCR models..."
        $modelsDir = Join-Path $root "easyocr_models"
        & $venvPython -c "import easyocr; easyocr.Reader(['en'], gpu=False, verbose=False, model_storage_directory=r'$modelsDir')"
    }

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
$backendExe = Join-Path $root "dist\ApexEventTracker\ApexEventTracker.exe"
$backendExeLegacy = Join-Path $root "dist\ApexEventTracker.exe"
if (-not (Test-Path $backendExe) -and -not (Test-Path $backendExeLegacy)) {
    throw "Backend EXE not found at $backendExe (or legacy $backendExeLegacy). PyInstaller build may have failed."
}

Write-Host "Building desktop app (Electron)..."
Push-Location "desktop"
if (-not (Test-Path "node_modules")) {
    npm install
}
if ($Target -eq "portable") {
    npm run build:portable
} else {
    npm run build
}
Pop-Location
