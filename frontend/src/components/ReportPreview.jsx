import { useEffect, useRef, useState } from "react";
import { exportReportPdf } from "../services/predictService";
import { getSeverityColor, getSeverityLabel } from "../utils/severity";
import "./ReportPreview.css";

function formatDate(value) {
  if (!value) return new Date().toLocaleDateString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function ReportPreview({ prediction, onClose, modelAccuracy }) {
  const reportRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const confidence = Math.max(0, Math.min(100, Number(prediction?.confidence) || 0));
  const regions = prediction?.geography?.typical_regions || [];
  const topPredictions = prediction?.top_predictions || [];

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !exporting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [exporting, onClose]);

  if (!prediction) return null;

  const handleExport = async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    setExportError("");
    try {
      await exportReportPdf(reportRef.current, prediction.plant);
    } catch (error) {
      console.error(error);
      setExportError("The PDF could not be created. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="report-preview-overlay" onClick={onClose}>
      <div className="report-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="report-preview-title" onClick={(event) => event.stopPropagation()}>
        <div className="report-preview-toolbar">
          <div>
            <span className="report-preview-eyebrow">LeafAI report</span>
            <h2 id="report-preview-title">Report preview</h2>
          </div>
          <button className="report-preview-close" onClick={onClose} aria-label="Close report preview">×</button>
        </div>

        <div className="report-preview-scroll">
          <article className="report-document" ref={reportRef}>
            <header className="report-document-header">
              <div>
                <span className="report-brand-mark">LA</span>
                <span className="report-brand-name">LeafAI</span>
              </div>
              <span className="report-document-type">Plant health analysis</span>
            </header>

            <section className="report-document-hero">
              <div>
                <p className="report-kicker">Analysis report</p>
                <h1>{prediction.plant || "Unknown plant"}</h1>
                <p className="report-disease">{prediction.disease || "Disease not identified"}</p>
              </div>
              <div className="report-date-block">
                <span>Generated</span>
                <strong>{formatDate(prediction.timestamp || prediction.date)}</strong>
              </div>
            </section>

            <section className="report-summary-grid">
              <div className="report-stat report-stat-confidence">
                <span className="report-stat-label">Confidence</span>
                <strong>{confidence}%</strong>
                <div className="report-progress-track"><span style={{ width: `${confidence}%` }} /></div>
              </div>
              <div className="report-stat">
                <span className="report-stat-label">Severity</span>
                <strong style={{ color: getSeverityColor(prediction.severity) }}>{getSeverityLabel(prediction.severity)}</strong>
                <span className="report-stat-note">Plant health risk level</span>
              </div>
              <div className="report-stat">
                <span className="report-stat-label">Model accuracy</span>
                <strong>{modelAccuracy ?? prediction.model_accuracy ?? "N/A"}{modelAccuracy ?? prediction.model_accuracy ? "%" : ""}</strong>
                <span className="report-stat-note">Validation performance</span>
              </div>
            </section>

            {(!prediction.is_confident || prediction.needs_review) && (
              <div className="report-review-note">
                <strong>Review recommended</strong>
                <span>{prediction.needs_review ? "This prediction should be checked against the leaf image." : "Try a clearer image for a more certain result."}</span>
              </div>
            )}

            {(prediction.scan_image || prediction.healthy_image) && (
              <section className="report-section report-image-grid">
                {prediction.scan_image && <div><span className="report-section-label">Uploaded image</span><img src={prediction.scan_image} crossOrigin="anonymous" alt="Uploaded leaf" /></div>}
                {prediction.healthy_image && <div><span className="report-section-label">Healthy reference</span><img src={prediction.healthy_image} crossOrigin="anonymous" alt="Healthy reference" /></div>}
              </section>
            )}

            {topPredictions.length > 0 && (
              <section className="report-section">
                <div className="report-section-heading"><span className="report-section-label">Model reasoning</span><h2>Top predictions</h2></div>
                <div className="report-prediction-list">
                  {topPredictions.slice(0, 5).map((item, index) => <div className="report-prediction-row" key={`${item.plant}-${item.disease}-${index}`}><span>{index + 1}</span><strong>{item.plant} <em>{item.disease}</em></strong><b>{item.confidence}%</b></div>)}
                </div>
              </section>
            )}

            <section className="report-detail-columns">
              <div className="report-section report-advice-section">
                <div className="report-section-heading"><span className="report-section-label">Care guidance</span><h2>Expert advice</h2></div>
                <p>{prediction.advice || "No expert advice is available for this result."}</p>
              </div>
              {prediction.geography && (
                <div className="report-section">
                  <div className="report-section-heading"><span className="report-section-label">Growing conditions</span><h2>Geography & climate</h2></div>
                  <dl className="report-facts">
                    <div><dt>Climate</dt><dd>{prediction.geography.climate || "Not available"}</dd></div>
                    <div><dt>Temperature</dt><dd>{prediction.geography.temperature_range || "Not available"}</dd></div>
                    <div><dt>Soil</dt><dd>{prediction.geography.soil || "Not available"}</dd></div>
                  </dl>
                  {regions.length > 0 && <p className="report-regions"><strong>Typical regions:</strong> {regions.join(", ")}</p>}
                </div>
              )}
            </section>

            <footer className="report-document-footer">LeafAI · Plant monitoring system · Keep this report with your care notes</footer>
          </article>
        </div>

        <div className="report-preview-actions">
          {exportError && <span className="report-export-error">{exportError}</span>}
          <button className="result-btn-secondary" onClick={onClose} disabled={exporting}>Close</button>
          <button className="result-btn-primary" onClick={handleExport} disabled={exporting}>{exporting ? "Creating PDF..." : "Download PDF"}</button>
        </div>
      </div>
    </div>
  );
}

export default ReportPreview;
