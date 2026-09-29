# LeafAI automated camera monitoring

The automation prototype watches one plant with one USB webcam. It captures a
frame on the configured schedule, sends it to the local Flask API, stores the
prediction, and surfaces disease, review, and camera/backend failure alerts on
the Dashboard. It does not control watering or any physical actuator.

## One-time setup

1. Activate or create the supported backend environment, then install the
   updated dependencies:

   ```powershell
   Set-Location leafai/backend
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

2. Start the Flask backend in one PowerShell window:

   ```powershell
   .\run_backend.ps1
   ```

3. Start the independent camera service in a second PowerShell window:

   ```powershell
   .\run_automation.ps1
   ```

4. Open the Dashboard. Select the camera index (normally `0`), give the plant
   a label, choose a scan interval, then enable scheduled monitoring. Use
   **Run scan now** to test the camera immediately.

The background service and the Flask backend must both be running. The browser
can be closed after settings are saved.

## Windows Task Scheduler

To launch monitoring when you sign in, create a task in **Task Scheduler**:

- Trigger: **At log on** for your Windows account.
- Action/program: `powershell.exe`
- Arguments: `-ExecutionPolicy Bypass -File "C:\full\path\to\plant monitoring system\leafai\backend\run_automation.ps1"`
- Start in: the `leafai\backend` directory.

Create a second task for `run_backend.ps1`, or start the backend by another
always-on method. Keep the webcam connected and avoid letting another program
hold the camera device.

## Troubleshooting

- If an automated scan fails, check the Dashboard alert and the service window.
- Try camera index `1` if Windows has another virtual or integrated camera at
  index `0`.
- A scheduled scan is intentionally limited to one plant in a stable camera
  view; the model is less reliable for wide shots containing many plants.
