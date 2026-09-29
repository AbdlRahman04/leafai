Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
$venvPy = Join-Path $here ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
  throw "Missing .venv. Create it first and install requirements."
}

Write-Host "Starting LeafAI camera automation service with: $venvPy"
& $venvPy ".\automation_service.py"
