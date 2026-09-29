param(
  [switch]$Preflight,
  [switch]$Original
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $here ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
  throw "Missing native Windows GPU environment. Follow docs/ENVIRONMENT_SETUP.md first."
}

Set-Location $here
# `conda activate` normally adds this directory. Add it explicitly so the
# launcher also works when the environment's Python is called by full path.
$cudaBin = Join-Path $here ".venv\Library\bin"
if (Test-Path $cudaBin) { $env:PATH = "$cudaBin;$env:PATH" }
Write-Host "Checking native Windows GPU with: $python"
& $python "gpu_preflight.py"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Preflight) { exit 0 }

Write-Host "Starting CNN training with the NVIDIA GPU..."
$trainer = if ($Original) { "train_cnn_original.py" } else { "train_cnn.py" }
Write-Host "Trainer: $trainer"
& $python $trainer
exit $LASTEXITCODE
