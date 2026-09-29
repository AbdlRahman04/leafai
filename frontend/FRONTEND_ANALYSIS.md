# Frontend Analysis Guide

This guide is a fast route through the LeafAI React frontend. Start here before changing a page, debugging a request, or tracing a user workflow.

## Quick Start

From `frontend/`:

```powershell
npm install
npm run dev
```

Useful checks:

```powershell
npm run lint
npm run build
```

The Vite app normally runs at `http://localhost:5173` and calls the backend at `http://localhost:4000`.

## Entry Points

| File | Responsibility |
| --- | --- |
| `src/main.jsx` | Mounts React, loads global CSS, enables `StrictMode` |
| `src/App.jsx` | Defines all React Router routes |
| `src/styles/shared.css` | Global layout, typography, cards, buttons, animations, responsive base |
| `src/services/api.js` | Shared Axios instance and backend base URL |

Routes are defined in `src/App.jsx`:

| Route | Page | Main purpose |
| --- | --- | --- |
| `/` | `pages/Home.jsx` | Landing navigation |
| `/choose` | `pages/Choose.jsx` | Choose upload or camera |
| `/upload` | `pages/Upload.jsx` | Single or bulk image analysis |
| `/camera` | `pages/Camera.jsx` | Capture an image from a camera |
| `/chat` | `pages/Chat.jsx` | Plant assistant conversation |
| `/report` | `pages/Report.jsx` | Browse saved reports |
| `/dashboard` | `pages/Dashboard.jsx` | Analytics and recent scans |

## Architecture Map

```text
Page component
  -> hook or event handler
  -> service module
  -> http://localhost:4000 backend
  -> state update / localStorage / rendered component
```

### Shared Components

- `components/BackButton.jsx`: reusable router navigation button.
- `components/ResultCard.jsx`: shared prediction result display for upload and camera flows.
- `components/ModelPerformanceModal.jsx`: loads and displays model metrics.
- `components/ChatWidget.jsx`: floating chat entry point.
- `components/TeamHover.jsx`: team/about interaction.

### Shared Logic

- `hooks/usePrediction.js`: prediction state, loading state, error state, submit, and reset.
- `utils/severity.js`: severity colors and human-readable labels.
- `utils/constants.js`: supported plants, diseases, and frontend API constant.

## Request Map

| Frontend module | Request | Payload / result |
| --- | --- | --- |
| `services/predictService.js` | `POST /predict` | `FormData` field `file`; returns prediction JSON |
| `services/predictService.js` | `POST /generate-pdf` | Prediction JSON; returns PDF blob |
| `services/chatService.js` | `POST /chatbot` | `{ question, context? }`; reads `answer` |
| `services/dashboardService.js` | `GET /dashboard-data` | Dashboard metrics and recent scans |
| `services/dashboardService.js` | `DELETE /prediction/:id` | Deletes one stored prediction |
| Page-specific geography consumers | `GET /plant-geography/:plant` | Search current callers before adding or changing this request |

When a request fails, inspect the service first, then inspect the matching Flask route in `leafai/backend/app.py`.

## Main User Flows

### Single Prediction

1. `Upload.jsx` or `Camera.jsx` obtains a `File` or image `Blob`.
2. `usePrediction.submitImage()` calls `predictDisease()`.
3. `predictService.js` posts multipart form data to `/predict`.
4. The result is held by the hook and written to `localStorage` as `leafai-last-prediction`.
5. `ResultCard.jsx` renders confidence, severity, advice, reference image, and actions.

### Bulk Prediction

`Upload.jsx` handles bulk mode directly. It loops through selected files, calls `predictDisease()` one file at a time, and updates progress after each response. A single failed image is stored as an item error while the remaining files continue.

### Camera Prediction

`Camera.jsx` owns browser camera permissions, device selection, stream lifetime, canvas capture, and retake behavior. The captured canvas is converted to a JPEG `Blob`, then enters the same prediction hook used by upload.

### Chat Context

`Chat.jsx` reads `leafai-last-prediction` and sends plant, disease, confidence, and severity as optional context. Chat history is persisted under `leafai-chat-history`; the contextual greeting marker uses `leafai-prediction-discussed`.

### Dashboard

`Dashboard.jsx` fetches `/dashboard-data` once on mount, transforms response objects into Recharts data arrays, and refreshes after deleting a scan.

## Fast Debugging Order

1. Confirm the backend is alive: open `http://localhost:4000/test`.
2. Confirm the frontend request URL in browser DevTools -> Network.
3. Confirm the request shape: `/predict` must contain a multipart field named `file`.
4. Read the response body and HTTP status before changing UI code.
5. Check the backend terminal for the traceback.
6. Check `hooks/usePrediction.js` for error normalization and state transitions.
7. Only then inspect the page component and CSS.

A frontend message such as `Prediction failed` can represent a network failure, CORS issue, HTTP error, image decoding problem, or backend model exception. The Network response and backend log distinguish these cases.

## Change Routing

- Page layout or interaction: edit the page JSX and its page CSS.
- Repeated prediction display: edit `components/ResultCard.jsx` and `ResultCard.css`.
- Repeated prediction behavior: edit `hooks/usePrediction.js` or `services/predictService.js`.
- API host: edit `services/api.js`; check `utils/constants.js` for duplicated usage.
- Chat persistence or contextual prompts: edit `pages/Chat.jsx` and `services/chatService.js`.
- Dashboard response mapping: edit `pages/Dashboard.jsx`; backend data shape lives in `app.py`.
- Global visual behavior: edit `styles/shared.css` only when the change truly applies everywhere.

## Validation Checklist

For upload or camera changes:

- Test a valid JPG or PNG.
- Test an unsupported or corrupted image.
- Test backend stopped and backend returning HTTP 500.
- Confirm loading state ends on both success and failure.
- Confirm a successful result appears in `ResultCard` and localStorage.

For dashboard changes:

- Test an empty prediction log.
- Test one scan and multiple scans.
- Delete a scan and confirm charts refresh.
- Check the browser console for Recharts data-shape warnings.

For chat changes:

- Test with no prediction context.
- Test after a healthy prediction.
- Test after a diseased prediction.
- Clear chat and reload to verify localStorage behavior.
