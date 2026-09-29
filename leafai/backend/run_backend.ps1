Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$venvPy = Join-Path $here ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
  throw "Missing .venv. Create it first: python -m venv .venv"
}

# Keep Conda's CUDA DLLs visible when this script is launched without first
# running `conda activate`.
$cudaBin = Join-Path $here ".venv\Library\bin"
if (Test-Path $cudaBin) { $env:PATH = "$cudaBin;$env:PATH" }
Write-Host "Starting backend with: $venvPy"
& $venvPy ".\app.py"

