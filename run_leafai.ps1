Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Join-Path $projectRoot "leafai\backend"
$frontendRoot = Join-Path $projectRoot "frontend"
$pythonPath = Join-Path $backendRoot ".venv\Scripts\python.exe"
$nodePath = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
$npmCommand = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
$npmCliPath = if ($npmCommand) { Join-Path (Split-Path $npmCommand) "node_modules\npm\bin\npm-cli.js" } else { $null }

if (-not (Test-Path $pythonPath)) {
  throw "Backend virtual environment not found: $pythonPath"
}
if (-not (Test-Path (Join-Path $frontendRoot "package.json"))) {
  throw "Frontend package.json not found: $frontendRoot"
}
if (-not $nodePath -or -not (Test-Path $npmCliPath)) {
  throw "Node.js/npm was not found. Install Node.js before starting LeafAI."
}

do {
  $answer = (Read-Host "Do you want to initiate a new analysis run? (Y/N)").Trim().ToUpperInvariant()
  if ($answer -notin @("Y", "N")) {
    Write-Host "Please enter Y or N." -ForegroundColor Yellow
  }
} while ($answer -notin @("Y", "N"))

$backendProcess = $null
$frontendProcess = $null
$automationProcess = $null

function Stop-ProcessTree([System.Diagnostics.Process]$process) {
  if ($null -ne $process -and -not $process.HasExited) {
    & taskkill.exe /PID $process.Id /T /F *> $null
  }
}

function Start-LoggedProcess {
  param(
    [string]$filePath,
    [string]$arguments,
    [string]$workingDirectory,
    [string]$processName
  )

  return Start-Process -FilePath $filePath -ArgumentList $arguments -WorkingDirectory $workingDirectory -NoNewWindow -PassThru
}

function Stop-PortProcess([int]$port) {
  $connections = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  foreach ($connection in $connections) {
    if ($connection.OwningProcess -and $connection.OwningProcess -ne $PID) {
      $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
      if ($process) {
        Write-Host "Stopping existing process on port $port (PID $($process.Id))..." -ForegroundColor Yellow
        Stop-ProcessTree $process
      }
    }
  }
}

try {
  Write-Host "[1/5] Starting frontend first on http://localhost:5173..." -ForegroundColor Cyan
  $frontendArguments = "`"$npmCliPath`" run dev -- --host 127.0.0.1"
  $frontendProcess = Start-LoggedProcess -filePath $nodePath -arguments $frontendArguments -workingDirectory $frontendRoot -processName "FRONTEND"
  Start-Sleep -Seconds 2
  if ($frontendProcess.HasExited) {
    throw "Frontend stopped during startup. Check the Vite output above."
  }
  Write-Host "Frontend process is running." -ForegroundColor Green

  if ($answer -eq "Y") {
    Write-Host "[2/5] Running model validation and refreshing the performance cache..." -ForegroundColor Cyan
    Push-Location $backendRoot
    try {
      & $pythonPath ".\app.py" "--model-only" "--refresh"
      if ($LASTEXITCODE -ne 0) {
        throw "Model validation failed with exit code $LASTEXITCODE."
      }
    } finally {
      Pop-Location
    }
  } else {
    Write-Host "[2/5] Using the existing model-performance cache." -ForegroundColor DarkGray
  }

  Write-Host "[3/5] Starting backend API on http://localhost:4000..." -ForegroundColor Cyan
  Stop-PortProcess 4000
  $backendProcess = Start-LoggedProcess -filePath $pythonPath -arguments ".\app.py" -workingDirectory $backendRoot -processName "BACKEND"

  Write-Host "[4/5] Waiting for the backend to become ready (up to 3 minutes)..." -ForegroundColor Cyan
  $backendReady = $false
  for ($attempt = 1; $attempt -le 180; $attempt += 1) {
    Start-Sleep -Seconds 1
    if ($backendProcess.HasExited) {
      throw "Backend stopped during startup. Check the API output above."
    }
    try {
      Invoke-WebRequest -Uri "http://127.0.0.1:4000/test" -UseBasicParsing -TimeoutSec 2 | Out-Null
      $backendReady = $true
      break
    } catch {
      if (($attempt % 10) -eq 0) {
        Write-Host "Still waiting for backend... $attempt seconds elapsed." -ForegroundColor DarkGray
      }
    }
  }
  Write-Host ""
  if (-not $backendReady) {
    throw "Backend did not become ready within 3 minutes. Check the API output above."
  }
  Write-Host "Backend is ready." -ForegroundColor Green

  Write-Host "[5/5] Starting camera automation service..." -ForegroundColor Cyan
  $automationProcess = Start-LoggedProcess -filePath $pythonPath -arguments ".\automation_service.py" -workingDirectory $backendRoot -processName "AUTOMATION"
  Start-Sleep -Seconds 1
  if ($automationProcess.HasExited) {
    throw "Camera automation stopped during startup. Check the output above."
  }
  Write-Host "Camera automation service is running." -ForegroundColor Green

  Write-Host ""
  Write-Host "LeafAI is running in this one PowerShell window." -ForegroundColor Green
  Write-Host "Frontend: http://localhost:5173"
  Write-Host "Backend:  http://localhost:4000"
  Write-Host "Frontend, backend, and camera automation share this console; their live output appears above." -ForegroundColor DarkGray
  Write-Host "Press Enter or close this window to stop all services."
  Read-Host | Out-Null
} finally {
  Stop-ProcessTree $automationProcess
  Stop-ProcessTree $frontendProcess
  Stop-ProcessTree $backendProcess
  Write-Host "LeafAI services stopped." -ForegroundColor DarkGray
}
