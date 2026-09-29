# Backend Analysis Guide

This guide is a fast route through the LeafAI Flask backend. Start with `app.py` for request behavior, then follow the linked helper or artifact only when the route requires it.

## Quick Start

From `leafai/backend/` on Windows:

```powershell
.\run_backend.ps1
```

The API normally runs at `http://localhost:4000`.

Health check:

```powershell
Invoke-RestMethod http://localhost:4000/test
```

The backend expects Python 3.10 and the pinned TensorFlow/Keras versions in `requirements.txt`.

## Control Points

| File | Responsibility |
| --- | --- |
| `app.py` | Flask app, model loading, routes, prediction, persistence, dashboard, PDF |
| `utils.py` | Label parsing, name normalization, top predictions, confidence threshold |
| `plant_knowledge.py` | Plant and disease definitions, symptoms, treatment, prevention |
| `llm_service.py` | Optional Groq chatbot integration and grounded prompt construction |
| `repair_model.py` | Patches incompatible Keras model config into a `.keras` copy |
| `train_cnn.py` | Trains and saves the CNN plus class index mapping |
| `run_backend.ps1` | Starts Flask with the backend virtual-environment interpreter |
| `.env.example` | Documents optional `GROQ_API_KEY` and `GROQ_MODEL` |

## Route Map

All application routes are currently registered directly in `app.py`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/` | Basic server status JSON |
| `GET` | `/test` | Lightweight health check |
| `POST` | `/predict` | Accepts image field `file`, runs CNN prediction, stores result |
| `GET` | `/dashboard-data` | Returns accuracy, distributions, trends, and recent predictions |
| `DELETE` | `/prediction/<prediction_id>` | Removes a stored prediction from the log |
| `GET` | `/plant-geography/<plant_name>` | Returns geography/reference information for a plant |
| `POST` | `/chatbot` | Uses Groq when configured, otherwise local grounded knowledge fallback |
| `POST` | `/generate-pdf` | Generates a PDF report from submitted prediction data |
| `GET` | `/uploads/<filename>` | Serves stored uploaded images |
| `GET` | `/healthy_references/<filename>` | Serves healthy reference images |

For a frontend failure, first identify the route and then read only that route plus its direct helper calls.

## Prediction Flow

```text
POST /predict
  -> validate request.files['file']
  -> save upload under storage/uploads
  -> decode and resize image
  -> normalize pixels
  -> model.predict()
  -> utils.get_top_predictions()
  -> calculate severity/advice/reference data
  -> append prediction log
  -> return JSON
```

Important prediction contracts:

- The multipart field name is exactly `file`.
- Model labels use the PlantVillage format `Plant___Disease`.
- `utils.py` converts raw labels into normalized `plant` and `disease` values.
- `CONFIDENCE_THRESHOLD` is `70.0` percent.
- Prediction results are persisted so dashboard and report features can use them.

## Model and Data Artifacts

Paths are relative to `leafai/backend/` unless `app.py` constructs an absolute path.

| Artifact | Role |
| --- | --- |
| `models/plant_disease_model.h5` | CNN model used for inference |
| `models/class_indices.json` | Dataset label-to-index mapping |
| `dataset/PlantVillage/color/` | Training/evaluation image folders |
| `storage/uploads/` | Uploaded prediction images; deleting this directory removes the saved scan images |
| `storage/predictions.json` | Persistent scan history containing one record for each unique uploaded image |
| `healthy_references/` | Healthy comparison images served to frontend |
| `cache/performance_cache.json` | Cached model accuracy/confusion data |

If a model or class mapping issue appears, verify the files exist and that the active interpreter is `.venv\Scripts\python.exe`.

## Dashboard Flow

`/dashboard-data` combines two sources:

1. Cached model performance from `cache/performance_cache.json`, recomputed from the dataset when missing or invalid.
2. The stored prediction log loaded and saved by helper functions near the top of `app.py`.

The response includes distributions, healthy-versus-diseased totals, average confidence, high-severity count, predictions over time, recent predictions, accuracy, and confusion-matrix data.

Delete behavior is separate: `DELETE /prediction/<id>` updates the prediction log, after which the frontend refetches dashboard data.

Scan history and uploaded images are runtime data, not source files. They are loaded from `storage/predictions.json` and `storage/uploads/` when the backend starts, so restarting the server does not clear the dashboard. Each upload is fingerprinted with SHA-256; re-uploading the exact same file reuses its existing prediction instead of adding a duplicate. Deleting the `storage` directory intentionally clears this history.

## Chatbot Flow

`POST /chatbot` receives:

```json
{
  "question": "How do I treat late blight?",
  "context": {
    "plant": "tomato",
    "disease": "late blight",
    "confidence": 92.4,
    "severity": "High"
  }
}
```

Behavior:

1. `llm_service.ask_llm()` is attempted when `GROQ_API_KEY` is configured.
2. If Groq is unavailable or fails, `build_chatbot_response()` formats the retrieved plant knowledge and saved scan summary locally.
3. `plant_knowledge.py` supplies the structured answer data.
4. The route returns an `answer` string for the frontend.

No API key is required for the keyword fallback.

## Fast Debugging Order

1. Run `GET /test` to separate server reachability from route/model failures.
2. Check the backend terminal immediately after the failing request.
3. Verify the active interpreter:

```powershell
python -c "import sys, tensorflow as tf, keras; print(sys.executable); print(tf.__version__); print(keras.__version__)"
```

4. Verify model and class-index paths.
5. Reproduce the route with a known image before changing frontend code.
6. Inspect normalization in `utils.py` if the plant or disease name is wrong.
7. Inspect `plant_knowledge.py` only after the normalized name is confirmed.

## Known Failure Patterns

### `/test` fails or connection is refused

The backend is not running on port 4000, or another process owns the port. Start with `run_backend.ps1` and check the terminal output.

### `/test` works but `/predict` returns HTTP 500

This is usually a model/interpreter, image decoding, missing artifact, or preprocessing problem. The current project notes record a TensorFlow/Keras mismatch involving `range_op`; reinstall the pinned requirements inside the backend `.venv` before changing route logic.

### Model loading fails with Keras configuration keys

Run:

```powershell
python repair_model.py
```

This writes `models/plant_disease_model_patched.keras`. Confirm `app.py` is configured to use the patched model before assuming the repair solved inference.

### Chat answers are generic

Check normalized plant/disease names and the keys in `plant_knowledge.py`. If hosted answers are expected, verify `GROQ_API_KEY` is set in the backend process environment and `GROQ_MODEL` names an available model.

### Dashboard is empty

Check the prediction log used by `app.py`, then confirm `/predict` successfully appends a record. Empty dashboard data is expected before the first successful scan.

## Training and Model Changes

`train_cnn.py` saves both the model and `class_indices.json`. Any model retraining must keep these artifacts aligned: output index `n` must continue to resolve to the same class label in the mapping.

After retraining:

1. Confirm both artifacts were regenerated.
2. Start the backend with the intended `.venv`.
3. Run `/test`.
4. Submit a known image to `/predict`.
5. Delete `cache/performance_cache.json` if dashboard performance must be recomputed.

## Validation Checklist

- `GET /test` returns success.
- `POST /predict` accepts a valid image under field `file`.
- Invalid or missing files return a useful error instead of crashing silently.
- A successful prediction is visible through `/dashboard-data`.
- Deleting a prediction removes it from the next dashboard response.
- `/chatbot` works both with and without Groq configured.
- `/generate-pdf` returns a readable PDF for a valid prediction payload.
- Upload and healthy-reference URLs resolve to existing files.
