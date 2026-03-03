$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$venvPython = Join-Path $root ".venv\Scripts\python.exe"
$requirementsPath = Join-Path $root "requirements.txt"

if (-not (Test-Path $venvPython)) {
  $pythonCmd = $null
  $pythonArgs = @()

  if (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
    $pythonArgs = @("-3", "-m", "venv", ".venv")
  } elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
    $pythonArgs = @("-m", "venv", ".venv")
  }

  if (-not $pythonCmd) {
    Write-Error "Python was not found. Install Python 3 and retry."
    exit 1
  }

  Push-Location $root
  & $pythonCmd @pythonArgs
  Pop-Location
}

if (-not (Test-Path $requirementsPath)) {
  Write-Error "requirements.txt not found at $requirementsPath"
  exit 1
}

& $venvPython -m pip install -r $requirementsPath
