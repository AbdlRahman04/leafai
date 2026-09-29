/**
 * Returns a color based on severity level.
 * @param {string} level — "High", "Moderate", or "None"/"Low"
 * @returns {string} — hex color
 */
export function getSeverityColor(level) {
  if (level === "High") return "#e74c3c";
  if (level === "Moderate") return "#f39c12";
  return "#2ecc71";
}

/**
 * Returns a human-readable severity label with context.
 * @param {string} level — severity level
 * @returns {string}
 */
export function getSeverityLabel(level) {
  if (level === "High") return "High Risk";
  if (level === "Moderate") return "Moderate Risk";
  if (level === "None") return "Healthy";
  return level || "Unknown";
}
