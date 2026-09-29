# Restructure + Design Refresh + Analytics Dashboard

## Part 1 — Codebase Restructuring

Reorganize files into a professional folder structure and extract duplicated logic into reusable modules.

### Current Structure
```
src/
  App.jsx
  main.jsx
  assets/
    backgroundd.jpg
    react.svg
  components/
    ChatWidget.jsx
    ModelPerformanceModal.jsx
    TeamHover.jsx
  pages/
    Camera.jsx
    Chat.jsx
    Choose.jsx
    Home.jsx
    Home.css
    Report.jsx
    Upload.jsx
```

### New Structure
```
src/
  App.jsx
  main.jsx
  assets/
    backgroundd.jpg
    react.svg
  services/
    api.js                  — Axios instance with base URL
    predictService.js       — predict(), downloadPDF()
    chatService.js          — sendChatMessage()
    dashboardService.js     — fetchDashboardData()
  hooks/
    usePrediction.js        — Shared prediction state + submit logic
  utils/
    severity.js             — getSeverityColor(), severity helpers
    constants.js            — PLANTS, DISEASES, API_BASE_URL
  components/
    TeamHover.jsx
    ModelPerformanceModal.jsx
    BackButton.jsx          — Reusable glass back button
    ResultCard.jsx          — Shared prediction result display
    ResultCard.css
  pages/
    Home.jsx  + Home.css
    Choose.jsx + Choose.css
    Upload.jsx + Upload.css
    Camera.jsx + Camera.css
    Chat.jsx + Chat.css
    Report.jsx + Report.css
    Dashboard.jsx + Dashboard.css
```

### What Gets Extracted

---

#### [NEW] `services/api.js`
Central axios instance — change the backend URL in one place.
```js
import axios from "axios";
const api = axios.create({ baseURL: "http://localhost:4000" });
export default api;
```

#### [NEW] `services/predictService.js`
Extracts the duplicated `/predict` call and `/generate-pdf` call from Upload + Camera.
```js
export async function predictDisease(file) { ... }
export async function downloadReport(prediction) { ... }
```

#### [NEW] `services/chatService.js`
Extracts the `/chatbot` fetch from Chat.jsx.
```js
export async function sendChatMessage(question) { ... }
```

#### [NEW] `services/dashboardService.js`
Extracts the `/dashboard-data` fetch from ModelPerformanceModal.
```js
export async function fetchDashboardData() { ... }
```

---

#### [NEW] `hooks/usePrediction.js`
Custom hook that encapsulates the shared prediction workflow used by both Upload and Camera pages:
```js
export function usePrediction() {
  // Returns: { prediction, loading, error, submitImage, reset }
  // Handles: API call, error handling, loading state
}
```

---

#### [NEW] `utils/severity.js`
Extracts the duplicated `getSeverityColor()` function.
```js
export function getSeverityColor(level) {
  if (level === "High") return "#e74c3c";
  if (level === "Moderate") return "#f39c12";
  return "#2ecc71";
}
```

#### [NEW] `utils/constants.js`
Centralizes the PLANTS and DISEASES arrays from Report.jsx.
```js
export const API_BASE_URL = "http://localhost:4000";
export const PLANTS = ["Apple", "Blueberry", ...];
export const DISEASES = ["Cedar Apple Rust", ...];
```

---

#### [NEW] `components/BackButton.jsx`
Reusable glass-styled back button (currently copy-pasted in Choose, Upload, Camera, Chat).
```jsx
export default function BackButton({ to, label = "Back" }) { ... }
```

#### [NEW] `components/ResultCard.jsx` + `ResultCard.css`
The prediction result display is **nearly identical** in Upload.jsx (lines 186-348) and Camera.jsx (lines 527-686). Extract into a shared component:
```jsx
export default function ResultCard({ prediction, onDownloadPDF, onShowModal }) {
  // Renders: plant, disease, confidence bar, severity, healthy reference,
  //          expert advice, geography, action buttons
}
```

---

### Files Modified by Restructuring

| File | Change |
|------|--------|
| `Upload.jsx` | Import from services/, hooks/, use ResultCard + BackButton |
| `Camera.jsx` | Import from services/, hooks/, use ResultCard + BackButton |
| `Chat.jsx` | Import from services/chatService |
| `Report.jsx` | Import PLANTS/DISEASES from utils/constants |
| `ModelPerformanceModal.jsx` | Import from services/dashboardService |
| `Choose.jsx` | Use BackButton component |

> [!IMPORTANT]
> The restructuring changes **zero functionality**. Every API call, state flow, and UI behavior stays identical — we're just moving code to better locations and eliminating duplication.

---

## Part 2 — Design Refresh (All Pages)

Apply the same glassmorphism, dark theme, animations, and premium typography from the Home page to all remaining pages.

### Design System (Shared)
- **Background**: Dark green gradient (consistent with Home overlay)
- **Cards**: Glassmorphism (translucent white + backdrop-blur + subtle border)
- **Typography**: Outfit for headings, Inter for body
- **Buttons**: Consistent pill-shaped buttons with hover lift effects
- **Animations**: Fade-in entrance, smooth transitions
- **No emojis** anywhere

### Pages to Redesign

| Page | New CSS | JSX Changes |
|------|---------|-------------|
| Choose | `Choose.css` | Dark bg, glass method cards with hover scale |
| Upload | `Upload.css` | Glass upload zone, glass result card |
| Camera | `Camera.css` | Glass camera card, glass result card |
| Chat | `Chat.css` | Glass chat container, styled bubbles |
| Report | `Report.css` | Glass filter bar, glass report cards |
| ModelPerformanceModal | Inline → CSS | Glass modal, styled charts |
| ResultCard | `ResultCard.css` | Glass card, confidence bar, badges |
| BackButton | Inline | Glass pill button |

---

## Part 3 — Analytics Dashboard (New Page)

### Backend Enhancement

#### [MODIFY] `leafai/backend/app.py`

Enhance `/dashboard-data` to return richer analytics:

| New Field | Data |
|-----------|------|
| `plant_distribution` | `{ "Tomato": 5, "Apple": 3, ... }` |
| `disease_distribution` | `{ "Early Blight": 4, ... }` |
| `healthy_vs_diseased` | `{ "healthy": 8, "diseased": 12 }` |
| `recent_predictions` | Last 10 scans with timestamp |
| `avg_confidence` | Average across all predictions |
| `high_severity_count` | Count of "High" severity |
| `predictions_over_time` | Grouped by date for trend chart |

### Frontend

#### [NEW] `Dashboard.jsx` + `Dashboard.css`

| Section | Chart Type | Data Source |
|---------|-----------|-------------|
| KPI Row | 4 stat cards | Total scans, accuracy, avg confidence, high severity count |
| Disease Frequency | Horizontal bar | `disease_distribution` |
| Plant Distribution | Donut | `plant_distribution` |
| Severity Breakdown | Pie | `severity_distribution` |
| Confidence Distribution | Bar | `confidence_distribution` |
| Healthy vs Diseased | Donut | `healthy_vs_diseased` |
| Scans Over Time | Area/line | `predictions_over_time` |
| Recent Scans | Glass table | `recent_predictions` |

**Charting library**: Recharts (already installed)

### Routing & Navigation

- [MODIFY] `App.jsx` — Add `/dashboard` route
- [MODIFY] `Home.jsx` — Add "Dashboard" navigation button

---

## Execution Order

1. **Part 1 first** — restructure so we have clean modules to style
2. **Part 2 next** — design all pages (including the new shared components)
3. **Part 3 last** — build Dashboard using the clean services/ and design system

## Verification Plan

### Manual Verification
- Start dev server and visually inspect all pages
- Verify all navigation routes work
- Verify Upload + Camera still predict correctly (same API flow)
- Test Dashboard with empty data — graceful empty states
- Test Dashboard after predictions — charts populate
- Verify hover effects and animations
