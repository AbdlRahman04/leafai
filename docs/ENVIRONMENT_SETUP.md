# LeafAI Windows GPU environment

LeafAI now uses one native Windows Python environment for the Flask API and
CNN training. WSL/Ubuntu is not part of the supported workflow. The native
Windows GPU build of TensorFlow is the legacy 2.10 line; TensorFlow 2.11 and
newer do not expose NVIDIA GPU support on native Windows.

| Purpose | Environment | Interpreter | GPU |
| --- | --- | --- | --- |
| Flask API, inference, and CNN training | `leafai/backend/.venv` | Windows Python 3.10 | NVIDIA GPU |

The repository-root `.venv` (Python 3.13) is not used by LeafAI. Do not install
LeafAI packages there.

## Prerequisites

1. Install the current Windows NVIDIA driver and confirm the MX450 (or another
   CUDA-capable NVIDIA GPU) is visible:

   ```powershell
   nvidia-smi
   ```

2. Install 64-bit Miniconda for Windows. TensorFlow's native-Windows GPU guide
   uses Conda to provide the CUDA 11.2 and cuDNN 8.1 runtime DLLs.

3. Install the Microsoft Visual C++ Redistributable 2015-2022 (x64).

## Create the environment

Run these commands from the repository root in Anaconda Prompt or PowerShell
after `conda` has been added to PATH:

```powershell
Set-Location leafai/backend

# If the old Python venv exists, keep it as a rollback before creating the
# Conda environment at the same path used by the launch scripts.
if (Test-Path .venv) { Move-Item .venv .venv-tf213-cpu }

conda create --prefix "$PWD\.venv" python=3.10 cudatoolkit=11.2 cudnn=8.1.0 -y
conda run --prefix "$PWD\.venv" python -m pip install --upgrade pip
conda run --prefix "$PWD\.venv" python -m pip install -r requirements.txt
conda run --prefix "$PWD\.venv" python -m pip check
```

`requirements.txt` pins TensorFlow 2.10.1/Keras 2.10, which is intentional for
native Windows CUDA support. Do not upgrade TensorFlow in this environment to
2.11 or later. The CUDA runtime installed by Conda is used through the
environment's `Library/bin` directory; no WSL or Linux CUDA driver is needed.

## Verify the GPU and train

The preflight performs a real TensorFlow operation on `/GPU:0` before training:

```powershell
Set-Location leafai/backend
conda run --prefix .venv python gpu_preflight.py
& .\train_windows_gpu.ps1 -Preflight
& .\train_windows_gpu.ps1
```

The first command should print at least one physical GPU and end with
The recovered original trainer is available when you specifically want the
old 32-image batch and /255 preprocessing:

```powershell
& .\train_windows_gpu.ps1 -Original
```

`GPU preflight passed`. If it reports an empty GPU list, run
`conda run --prefix .venv python -c "import tensorflow as tf; print(tf.__version__, tf.config.list_physical_devices('GPU'))"`
and verify that the NVIDIA driver and Conda CUDA packages are installed.

Training writes the model and `class_indices.json` into the shared
`leafai/backend/models/` directory. Start the API with the same environment:

```powershell
Set-Location leafai/backend
.\run_backend.ps1
```

## Health checks

```powershell
Set-Location leafai/backend
conda run --prefix .venv python -m pip check
conda run --prefix .venv python gpu_preflight.py
```

Keep `leafai/backend/.venv-tf213-cpu` until the new GPU environment has passed
preflight and a sample prediction works; it is a recoverable rollback copy.
