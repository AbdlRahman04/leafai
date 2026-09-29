import api, { API_BASE_URL } from "./api";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Send an image file to the backend for disease prediction.
 * @param {File|Blob} file — the image file or blob to analyze
 * @returns {Promise<Object>} — prediction result from backend
 */
export async function predictDisease(file, runKey) {
  const formData = new FormData();
  formData.append("file", file);
  if (runKey) formData.append("run_key", runKey);

  const response = await api.post("/predict", formData);
  return response.data;
}

/**
 * Download a PDF report for a given prediction.
 * @param {Object} prediction — the prediction object from predictDisease
 */
export async function downloadReport(prediction) {
  const response = await fetch(`${API_BASE_URL}/generate-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: new Date().toLocaleDateString(),
      plant: prediction.plant,
      disease: prediction.disease,
      confidence: prediction.confidence,
      severity: prediction.severity,
      advice: prediction.advice,
      healthy_image: prediction.healthy_image,
    }),
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plant_disease_report.pdf";
  a.click();
}

export async function exportReportPdf(reportElement, plantName = "plant") {
  const canvas = await html2canvas(reportElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#fbfdf9",
    logging: false,
  });
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageWidth = pageWidth;
  const imageHeight = (canvas.height * imageWidth) / canvas.width;
  const imageData = canvas.toDataURL("image/jpeg", 0.96);

  let remainingHeight = imageHeight;
  let offset = 0;
  while (remainingHeight > 0) {
    if (offset > 0) pdf.addPage();
    pdf.addImage(imageData, "JPEG", 0, -offset, imageWidth, imageHeight);
    offset += pageHeight;
    remainingHeight -= pageHeight;
  }
  pdf.save(`leafai-${String(plantName).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "plant"}-report.pdf`);
}
