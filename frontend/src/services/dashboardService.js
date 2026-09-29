import { API_BASE_URL } from "./api";

export async function startAnalysisRun(runKey) {
  const response = await fetch(`${API_BASE_URL}/start-analysis-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_key: runKey }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start analysis run (${response.status})`);
  }

  return response.json();
}

/**
 * Fetch dashboard/model performance data from the backend.
 * @returns {Promise<Object>} — dashboard data including accuracy, distributions, etc.
 */
export async function fetchDashboardData() {
  const response = await fetch(`${API_BASE_URL}/dashboard-data?ts=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard data (${response.status})`);
  }

  return response.json();
}

export async function deletePrediction(predictionId) {
  const response = await fetch(`${API_BASE_URL}/prediction/${predictionId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete prediction (${response.status})`);
  }

  return response.json();
}

export async function deletePredictions(predictionIds) {
  const response = await fetch(`${API_BASE_URL}/predictions/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: predictionIds }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to delete predictions (${response.status})`);
  }

  return response.json();
}

export async function deleteAnalysisRun(runKey) {
  const response = await fetch(`${API_BASE_URL}/analysis-run/${encodeURIComponent(runKey)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to delete analysis run (${response.status})`);
  }

  return response.json();
}

export async function saveAnalysis(runKey) {
  const response = await fetch(`${API_BASE_URL}/save-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_key: runKey }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to save analysis (${response.status})`);
  }

  return response.json();
}

export async function fetchAutomationConfig() {
  const response = await fetch(`${API_BASE_URL}/automation/config`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load automation configuration (${response.status})`);
  return response.json();
}

export async function updateAutomationConfig(config) {
  const response = await fetch(`${API_BASE_URL}/automation/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Failed to save automation configuration (${response.status})`);
  return body;
}

export async function fetchAutomationStatus() {
  const response = await fetch(`${API_BASE_URL}/automation/status`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load automation status (${response.status})`);
  return response.json();
}

export async function runAutomationNow() {
  const response = await fetch(`${API_BASE_URL}/automation/run-now`, { method: "POST" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Failed to queue an automated scan (${response.status})`);
  return body;
}

export async function fetchAutomationAlerts() {
  const response = await fetch(`${API_BASE_URL}/automation/alerts`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load automation alerts (${response.status})`);
  return response.json();
}

export async function markAutomationAlertRead(alertId) {
  const response = await fetch(`${API_BASE_URL}/automation/alerts/${encodeURIComponent(alertId)}/read`, {
    method: "POST",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Failed to update alert (${response.status})`);
  return body;
}
