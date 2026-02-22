param(
    [string]$ISCC = "E:\Inno Setup 6\ISCC.exe",
    [switch]$Fast,
    [switch]$SkipOcrDeps,
    [switch]$SkipModels,
    [switch]$ReuseBackend
)

$ErrorActionPreference = "Stop"

function Invoke-TimedStep {
    param(
        [string]$Name,
        [scriptblock]$Action
    )

    Write-Host "=== $Name ==="
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    & $Action
    $stopwatch.Stop()
    $elapsed = $stopwatch.Elapsed
    $elapsedText = "{0:00}:{1:00}:{2:00}.{3:000}" -f $elapsed.Hours, $elapsed.Minutes, $elapsed.Seconds, $elapsed.Milliseconds
    Write-Host "--- Completed: $Name in $elapsedText ---"
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$metaPath = Join-Path $root "app_meta.json"
if (-not (Test-Path $metaPath)) {
    throw "app_meta.json not found at $metaPath"
}
$appMeta = Get-Content -Raw -Path $metaPath | ConvertFrom-Json
$internalName = [string]$appMeta.internalName
if ([string]::IsNullOrWhiteSpace($internalName)) {
    throw "app_meta.json is missing internalName"
}

Invoke-TimedStep "Sync app metadata" {
    npm run sync:meta
}

$candidatePaths = @(
    $ISCC,
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)
$isccPath = $candidatePaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $isccPath) {
    throw "ISCC.exe not found. Install Inno Setup 6 or pass -ISCC <path>."
}

$useFastBuild = $Fast -or ($env:AET_FAST_BUILD -eq "1")
$skipOcrDeps = $SkipOcrDeps -or ($env:AET_SKIP_OCR_DEPS -eq "1")
$skipModels = $SkipModels -or ($env:AET_SKIP_MODELS -eq "1")
$reuseBackend = $ReuseBackend -or ($env:AET_REUSE_BACKEND -eq "1")

Write-Host "Build flags: Fast=$useFastBuild SkipOcrDeps=$skipOcrDeps SkipModels=$skipModels ReuseBackend=$reuseBackend"

Invoke-TimedStep "Frontend install (if needed)" {
    if (-not (Test-Path "frontend\node_modules")) {
        Push-Location "frontend"
        npm install
        Pop-Location
    } else {
        Write-Host "frontend/node_modules already present. Skipping npm install."
    }
}

Invoke-TimedStep "Frontend build" {
    Push-Location "frontend"
    npm run build
    Pop-Location
}

Invoke-TimedStep "Collect third-party licenses" {
    & (Join-Path $root "scripts\copy_third_party_licenses.ps1")
}

Invoke-TimedStep "Build backend EXE (PyInstaller)" {
    $venvPython = Join-Path $root ".venv\Scripts\python.exe"
    $backendExe = Join-Path $root ("dist\{0}\{0}.exe" -f $internalName)
    $backendExeLegacy = Join-Path $root ("dist\{0}.exe" -f $internalName)
    if ($reuseBackend -and ((Test-Path $backendExe) -or (Test-Path $backendExeLegacy))) {
        Write-Host "Reusing existing backend EXE"
        return
    }
    if (Test-Path "build") {
        Remove-Item -Recurse -Force "build"
    }
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist"
    }
    if (Test-Path $venvPython) {
        if (-not $skipOcrDeps) {
            Write-Host "Installing GPU OCR dependencies (EasyOCR + CUDA torch)..."
            $torchIndexUrl = $env:TORCH_CUDA_INDEX_URL
            if (-not $torchIndexUrl) {
                $torchIndexUrl = "https://download.pytorch.org/whl/cu121"
            }
            & $venvPython -m pip install easyocr
            & $venvPython -m pip install torch torchvision torchaudio --index-url $torchIndexUrl
        } else {
            Write-Host "Skipping OCR dependency install."
        }
        if (-not $skipModels) {
            Write-Host "Pre-downloading EasyOCR models..."
            $modelsDir = Join-Path $root "easyocr_models"
            & $venvPython -c "import easyocr; easyocr.Reader(['en'], gpu=False, verbose=False, model_storage_directory=r'$modelsDir')"
        } else {
            Write-Host "Skipping EasyOCR model pre-download."
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
    if (-not (Test-Path $backendExe) -and -not (Test-Path $backendExeLegacy)) {
        throw "Backend EXE not found at $backendExe (or legacy $backendExeLegacy). PyInstaller build may have failed."
    }
}

Invoke-TimedStep "Build desktop app (unpacked)" {
    Push-Location "desktop"
    if (-not (Test-Path "node_modules")) {
        npm install
    } else {
        Write-Host "desktop/node_modules already present. Skipping npm install."
    }
    npm run build:dir
    Pop-Location
}

Invoke-TimedStep "Build installer (Inno Setup)" {
    $innoScript = Join-Path $root "inno\VODInsights.iss"
    if ($useFastBuild) {
        & $isccPath "/DAET_FAST_BUILD=1" $innoScript
    } else {
        & $isccPath $innoScript
    }
}
