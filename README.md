# LeafAI Plant Monitoring System

LeafAI is a full-stack plant disease monitoring application combining a React/Vite interface with a Flask/TensorFlow backend for image prediction, plant-care guidance, reports, and analytics.

## Project map

```text
plant monitoring system/
├── frontend/                    React/Vite client (existing path)
│   └── src/                     pages, components, services, hooks, utils
├── leafai/
│   └── backend/                 Flask API and ML workspace (existing path)
│       ├── app.py               API routes and prediction workflow
│       ├── models/               Trained model and class metadata
│       ├── dataset/              Training/evaluation images
│       ├── healthy_references/   Reference images served by the API
│       ├── storage/              Runtime uploads and prediction history
│       ├── cache/                Generated performance cache
│       ├── train_cnn.py          Model training entry point
│       └── requirements.txt       Backend dependencies
├── docs/                        Project-level documentation
└── RESTRUCTURE_PLAN.md          Detailed improvement backlog
```

The existing application paths are intentionally preserved. Documentation and clear boundaries are additive, so imports and deployment commands do not need to change.

For the supported native Windows GPU backend and training environment, see
[Environment setup](docs/ENVIRONMENT_SETUP.md).

## Run locally

Backend (PowerShell):

```powershell
Set-Location leafai/backend
.\run_backend.ps1
```

Frontend:

```powershell
Set-Location frontend
npm install
npm run dev
```

The API runs at `http://localhost:4000` and the Vite client at `http://localhost:5173`.

Copy `leafai/backend/.env.example` to `leafai/backend/.env` and set `GROQ_API_KEY` if hosted chatbot answers are enabled. The key stays on the backend and is excluded from Git.

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for organization guidelines.
For scheduled USB-camera monitoring and Windows startup, see
[automation setup](docs/AUTOMATION_SETUP.md).
