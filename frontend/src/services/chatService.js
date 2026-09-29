import { API_BASE_URL } from "./api";

export async function sendChatMessage(question, context = null, messages = [], useScanHistory = false) {
  const body = { question, use_scan_history: useScanHistory };
  if (context) body.context = context;
  if (messages.length) {
    body.history = messages.slice(-8).map((message) => ({
      role: message.sender === "user" ? "user" : "bot",
      text: message.text,
    }));
  }

  const response = await fetch(`${API_BASE_URL}/chatbot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The assistant could not answer right now.");
  return {
    answer: data.answer || "No response received.",
    source: data.source || "local",
    sources: Array.isArray(data.sources) ? data.sources : [],
    resolvedPlant: data.resolved_plant || null,
    plantResolution: data.plant_resolution || null,
    usedScanHistory: data.used_scan_history === true,
    historySummary: data.history_summary || null,
  };
}

export async function fetchChatTopics() {
  const response = await fetch(`${API_BASE_URL}/chatbot/topics`);
  if (!response.ok) throw new Error("Plant topics are unavailable");
  const data = await response.json();
  return Array.isArray(data.plants) ? data.plants : [];
}
