@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo       LeafAI launcher - one shared console window
echo ============================================================
echo Starting the frontend, backend, and camera automation here.
echo Their live output will appear in this one window.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_leafai.ps1"
if errorlevel 1 (
  echo.
  echo LeafAI stopped with an error.
)

echo.
echo Press any key to close this launcher.
pause >nul
endlocal
