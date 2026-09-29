import { useEffect, useState } from "react";
import { usePrediction } from "../hooks/usePrediction";
import { predictDisease } from "../services/predictService";
import { fetchDashboardData, saveAnalysis, startAnalysisRun } from "../services/dashboardService";
import ResultCard from "../components/ResultCard";
import ModelPerformanceModal from "../components/ModelPerformanceModal";
import ReportPreview from "../components/ReportPreview";
import "./Upload.css";

function Upload() {
  const [mode, setMode] = useState("single");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [bulkImages, setBulkImages] = useState([]);
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkDone, setBulkDone] = useState(false);
  const [bulkRunKey, setBulkRunKey] = useState("");
  const [bulkSaveState, setBulkSaveState] = useState("idle");
  const [bulkSaveMessage, setBulkSaveMessage] = useState("");
  const [selectedBulkResult, setSelectedBulkResult] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [reportPrediction, setReportPrediction] = useState(null);

  const { prediction, loading, error, submitImage } = usePrediction();

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
    bulkImages.forEach(({ preview: imagePreview }) => URL.revokeObjectURL(imagePreview));
  }, [preview, bulkImages]);

  const handleImageChange = (file) => {
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!image) return;
    const result = await submitImage(image, crypto.randomUUID());
    if (result) {
      localStorage.setItem("leafai-last-prediction", JSON.stringify(result));
    }
  };

  const handleBulkImageChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    bulkImages.forEach(({ preview: imagePreview }) => URL.revokeObjectURL(imagePreview));
    setBulkImages(files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    })));
    setBulkResults([]);
    setBulkProgress(0);
    setBulkDone(false);
    setBulkRunKey("");
    setBulkSaveState("idle");
    setBulkSaveMessage("");
    event.target.value = "";
  };

  const handleBulkSubmit = async () => {
    if (!bulkImages.length || bulkLoading) return;

    setBulkLoading(true);
    setBulkResults([]);
    setBulkProgress(0);
    setBulkDone(false);
    setBulkSaveState("idle");
    setBulkSaveMessage("");
    const results = [];
    const requestedRunKey = crypto.randomUUID();
    let runKey = requestedRunKey;

    try {
      const run = await startAnalysisRun(requestedRunKey);
      runKey = run.run_key;
      setBulkRunKey(run.run_key);
    } catch (error) {
      setBulkLoading(false);
      setBulkDone(false);
      setBulkSaveState("error");
      setBulkSaveMessage(error.message || "Unable to start this analysis run.");
      return;
    }

    for (let index = 0; index < bulkImages.length; index += 1) {
      const item = bulkImages[index];
      try {
        const result = await predictDisease(item.file, runKey);
        if (!bulkRunKey && result?.run_key) setBulkRunKey(result.run_key);
        results.push({ ...item, prediction: result });
      } catch (error) {
        const timedOut = error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT";
        results.push({
          ...item,
          error: timedOut
            ? "This image took longer than 90 seconds. Try a smaller image or try again later."
            : error?.response?.data?.error || "Analysis failed for this image.",
        });
      }
      setBulkResults([...results]);
      setBulkProgress(index + 1);
    }

    setBulkLoading(false);
    setBulkDone(true);
  };

  const handleSaveBulkAnalysis = async () => {
    const savedRunKey = bulkRunKey || bulkResults.find((item) => item.prediction)?.prediction?.run_key;
    if (!savedRunKey || bulkSaveState === "saving") return;

    setBulkSaveState("saving");
    setBulkSaveMessage("");
    try {
      const saved = await saveAnalysis(savedRunKey);
      const dashboardData = await fetchDashboardData();
      const savedOnDashboard = (dashboardData.scan_history || []).filter((scan) => scan.run_key === savedRunKey).length;
      if (savedOnDashboard < saved.saved_count) {
        throw new Error(`Save verification failed: Dashboard returned ${savedOnDashboard} of ${saved.saved_count} results.`);
      }
      setBulkSaveState("saved");
      setBulkSaveMessage(`${saved.saved_count} result${saved.saved_count === 1 ? "" : "s"} saved and verified on the Dashboard.`);
    } catch (error) {
      setBulkSaveState("error");
      setBulkSaveMessage(error.message || "Unable to save this analysis.");
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    if (nextMode === "single") setBulkResults([]);
  };

  const removeBulkImage = (previewToRemove) => {
    const imageToRemove = bulkImages.find(({ preview: imagePreview }) => imagePreview === previewToRemove);
    if (imageToRemove) URL.revokeObjectURL(imageToRemove.preview);
    setBulkImages((currentImages) => currentImages.filter(({ preview: imagePreview }) => imagePreview !== previewToRemove));
    setBulkResults((currentResults) => currentResults.filter(({ preview: imagePreview }) => imagePreview !== previewToRemove));
  };

  return (
    <div className="page-container upload-page">
      <h1 className="page-title">Upload Leaf Image</h1>
      <p className="page-subtitle">
        Analyze one leaf or compare multiple scans at once
      </p>

      <div className="upload-mode-switch" role="tablist" aria-label="Upload mode">
        <button
          className={mode === "single" ? "active" : ""}
          onClick={() => switchMode("single")}
          role="tab"
          aria-selected={mode === "single"}
        >
          Single Analysis
        </button>
        <button
          className={mode === "bulk" ? "active" : ""}
          onClick={() => switchMode("bulk")}
          role="tab"
          aria-selected={mode === "bulk"}
        >
          Bulk Analysis
        </button>
      </div>

      {mode === "single" ? <div className="page-content">
        {/* LEFT CARD */}
        <div className="glass-card" style={{ flex: 1, textAlign: "center" }}>
          <label className="upload-dropzone">
            <div className="upload-dropzone-text">
              {image ? image.name : "Click or Drag & Drop Image Here"}
            </div>
            {!image && (
              <div className="upload-dropzone-hint">
                Supports JPG, PNG, WEBP
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleImageChange(e.target.files[0])}
            />
          </label>

          {preview && (
            <img
              src={preview}
              alt="Uploaded"
              className="upload-preview"
            />
          )}

          <button
            className="upload-submit-btn"
            onClick={handleSubmit}
            disabled={!image || loading}
          >
            {loading ? "Analyzing..." : "Detect Disease"}
          </button>
          {loading && <p className="ui-processing" role="status">Analyzing leaf features and comparing conditions…</p>}
          {error && <p className="ui-message ui-message-error" role="alert">{error}</p>}
        </div>

        {/* RIGHT CARD */}
        <ResultCard
          prediction={prediction}
          onDownloadPDF={() => setReportPrediction(prediction)}
          onShowModal={() => setShowModal(true)}
        />
      </div> : (
        <div className="bulk-upload-layout">
          <div className="glass-card bulk-upload-card">
            <label className="upload-dropzone bulk-dropzone">
              <div className="upload-dropzone-text">Select multiple leaf images</div>
              <div className="upload-dropzone-hint">Choose JPG, PNG, or WEBP files to compare</div>
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={handleBulkImageChange}
              />
            </label>

            {bulkImages.length > 0 && (
              <div className="bulk-selection-summary">
                <strong>{bulkImages.length} image{bulkImages.length === 1 ? "" : "s"} selected</strong>
                <span>Each image will receive its own analysis.</span>
              </div>
            )}

            <button
              className="upload-submit-btn"
              onClick={handleBulkSubmit}
              disabled={!bulkImages.length || bulkLoading}
            >
              {bulkLoading
                ? `Analyzing ${bulkProgress} of ${bulkImages.length}...`
                : "Analyze All Images"}
            </button>
          </div>

          {bulkImages.length > 0 && mode === "preview" && (
            <div className="bulk-preview-grid">
              {bulkImages.map((item) => (
                <div className="bulk-preview-item" key={item.preview}>
                  <img src={item.preview} alt={item.file.name} />
                  <span>{item.file.name}</span>
                  <button
                    className="bulk-remove-btn"
                    onClick={() => removeBulkImage(item.preview)}
                    aria-label={`Remove ${item.file.name}`}
                    title="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {bulkImages.length > 0 && (bulkLoading || bulkDone) && (
            <div className={`bulk-status-panel${bulkDone ? " is-done" : ""}`} aria-live="polite">
              <div className="bulk-status-heading">
                <strong>{bulkDone ? "Done" : "Analyzing images"}</strong>
                <span>{bulkProgress} / {bulkImages.length}</span>
              </div>
              <div className="bulk-status-track" role="progressbar" aria-valuemin="0" aria-valuemax={bulkImages.length} aria-valuenow={bulkProgress}>
                <span style={{ width: `${bulkImages.length ? (bulkProgress / bulkImages.length) * 100 : 0}%` }} />
              </div>
              <p>{bulkDone ? "All selected images have been processed." : "Your images are being analyzed one at a time."}</p>
              {bulkDone && (
                <div className="bulk-save-actions">
                  <button className="bulk-save-btn" onClick={handleSaveBulkAnalysis} disabled={bulkSaveState === "saving" || bulkSaveState === "saved"}>
                    {bulkSaveState === "saving" ? "Saving..." : bulkSaveState === "saved" ? "Saved to Dashboard" : "Save Analysis to Dashboard"}
                  </button>
                  {bulkSaveMessage && <span className={`bulk-save-message ${bulkSaveState}`}>{bulkSaveMessage}</span>}
                </div>
              )}
            </div>
          )}

          {bulkResults.length > 0 && (
            <section className="bulk-results-section">
              <div className="bulk-results-heading">
                <h2>Multiple Analysis Results</h2>
                <span>{bulkResults.filter((item) => item.prediction).length} completed</span>
              </div>
              <div className="bulk-results-grid">
                {bulkResults.map((item) => (
                  <article className="bulk-result-card" key={item.preview}>
                    <img src={item.preview} alt={item.file.name} className="bulk-result-image" />
                    <div className="bulk-result-content">
                      <p className="bulk-result-filename" title={item.file.name}>{item.file.name}</p>
                      {item.prediction ? (
                        <>
                          <h3>{item.prediction.plant}</h3>
                          <p className="bulk-result-disease">{item.prediction.disease}</p>
                          <div className="bulk-result-meta">
                            <span>{item.prediction.confidence}% confidence</span>
                            <span className={`bulk-severity ${item.prediction.severity?.toLowerCase()}`}>
                              {item.prediction.severity}
                            </span>
                          </div>
                          <div className="bulk-result-bar">
                            <span style={{ width: `${item.prediction.confidence || 0}%` }} />
                          </div>
                          <button
                            className="bulk-view-details-btn"
                            onClick={() => setSelectedBulkResult(item)}
                          >
                            View Details
                          </button>
                        </>
                      ) : (
                        <p className="bulk-result-error">{item.error}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showModal && <ModelPerformanceModal onClose={() => setShowModal(false)} />}

      {reportPrediction && (
        <ReportPreview prediction={reportPrediction} onClose={() => setReportPrediction(null)} />
      )}

      {selectedBulkResult?.prediction && (
        <div className="bulk-detail-overlay" onClick={() => setSelectedBulkResult(null)}>
          <div className="bulk-detail-modal" onClick={(event) => event.stopPropagation()}>
            <button
              className="bulk-detail-close"
              onClick={() => setSelectedBulkResult(null)}
              aria-label="Close details"
            >
              ×
            </button>
            <h2>Analysis Details</h2>
            <h4 className="bulk-detail-image-label">Uploaded Image</h4>
            <img
              src={selectedBulkResult.preview}
              alt={selectedBulkResult.file.name}
              className="bulk-detail-image"
            />
            {selectedBulkResult.prediction.healthy_image && (
              <>
                <h4 className="bulk-detail-image-label">Healthy Reference</h4>
                <img
                  src={selectedBulkResult.prediction.healthy_image}
                  alt={`${selectedBulkResult.prediction.plant} healthy reference`}
                  className="bulk-detail-image"
                />
              </>
            )}
            <p className="bulk-detail-filename">{selectedBulkResult.file.name}</p>
            <div className="bulk-detail-heading">
              <div>
                <h3>{selectedBulkResult.prediction.plant}</h3>
                <p>{selectedBulkResult.prediction.disease}</p>
              </div>
              <span className={`bulk-severity ${selectedBulkResult.prediction.severity?.toLowerCase()}`}>
                {selectedBulkResult.prediction.severity}
              </span>
            </div>
            <div className="bulk-detail-confidence">
              <strong>Confidence: {selectedBulkResult.prediction.confidence}%</strong>
              <div className="bulk-result-bar">
                <span style={{ width: `${selectedBulkResult.prediction.confidence || 0}%` }} />
              </div>
            </div>
            {selectedBulkResult.prediction.needs_review && (
              <p className="bulk-detail-warning">This prediction needs review.</p>
            )}
            {selectedBulkResult.prediction.top_predictions?.length > 0 && (
              <div className="bulk-detail-section">
                <h4>Top Predictions</h4>
                {selectedBulkResult.prediction.top_predictions.map((item, index) => (
                  <p key={index}>{index + 1}. {item.plant} - {item.disease} ({item.confidence}%)</p>
                ))}
              </div>
            )}
            <div className="bulk-detail-section">
              <h4>Expert Advice</h4>
              <p>{selectedBulkResult.prediction.advice || "No expert advice available."}</p>
            </div>
            {selectedBulkResult.prediction.geography && (
              <div className="bulk-detail-section">
                <h4>Geography & Climate</h4>
                <p>Climate: {selectedBulkResult.prediction.geography.climate || "—"}</p>
                <p>Temperature: {selectedBulkResult.prediction.geography.temperature_range || "—"}</p>
                <p>Soil: {selectedBulkResult.prediction.geography.soil || "—"}</p>
                <p>Regions: {selectedBulkResult.prediction.geography.typical_regions?.join(", ") || "—"}</p>
              </div>
            )}
            <div className="bulk-detail-actions">
              <button
                className="result-btn-primary"
                onClick={() => setReportPrediction(selectedBulkResult.prediction)}
              >
                Download Report (PDF)
              </button>
              <button
                className="result-btn-secondary"
                onClick={() => {
                  setSelectedBulkResult(null);
                  setShowModal(true);
                }}
              >
                View Model Performance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Upload;
