import { getSeverityColor } from "../utils/severity";
import "./ResultCard.css";

/**
 * Shared prediction result card used by both Upload and Camera pages.
 * Displays: plant, disease, confidence, severity, healthy reference,
 * expert advice, geography, and action buttons.
 */
export default function ResultCard({ prediction, onDownloadPDF, onShowModal }) {
  if (!prediction) return null;

  return (
    <div className="result-card">
      <h2 className="result-card-title">Analysis Result</h2>

      <p><strong>Plant:</strong> {prediction.plant}</p>
      <p><strong>Disease:</strong> {prediction.disease}</p>

      {/* Confidence Progress Bar */}
      <div className="result-confidence">
        <strong>Confidence:</strong>
        <div className="result-confidence-track">
          <div
            className="result-confidence-bar"
            style={{ width: `${prediction.confidence || 0}%` }}
          />
        </div>
        <p className="result-confidence-value">{prediction.confidence}%</p>
      </div>

      {!prediction.is_confident && (
        <p className="result-warning">
          Low confidence prediction. Try a clearer image.
        </p>
      )}

      <p>
        <strong>Severity:</strong>{" "}
        <span
          className="result-severity-badge"
          style={{ color: getSeverityColor(prediction.severity) }}
        >
          {prediction.severity}
        </span>
      </p>

      {prediction.healthy_image && (
        <>
          <h3 className="result-section-title">Healthy Reference</h3>
          <img
            src={prediction.healthy_image}
            alt="Healthy"
            className="result-healthy-image"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </>
      )}

      <div className="result-advice-box">
        <strong>Expert Advice:</strong>
        <p className="result-advice-text">{prediction.advice}</p>
      </div>

      {/* Geography */}
      {prediction.geography && (
        <div className="result-geography-box">
          <h3 className="result-section-title" style={{ marginTop: 0 }}>
            Geography & Climate
          </h3>
          <p><strong>Climate:</strong> {prediction.geography.climate}</p>
          <p><strong>Temperature:</strong> {prediction.geography.temperature_range}</p>
          <p><strong>Soil:</strong> {prediction.geography.soil}</p>
          <strong>Typical Regions:</strong>
          <ul className="result-regions-list">
            {prediction.geography.typical_regions.map((region, index) => (
              <li key={index}>{region}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="result-actions">
        <button className="result-btn-primary" onClick={onDownloadPDF}>
          Download Report (PDF)
        </button>
        <button className="result-btn-secondary" onClick={onShowModal}>
          View Model Performance
        </button>
      </div>
    </div>
  );
}
