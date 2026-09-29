import { useNavigate } from "react-router-dom";
import "./Choose.css";

function Choose() {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <h1 className="page-title">Choose Detection Method</h1>
      <p className="page-subtitle">
        Select how you want to analyze your plant leaf
      </p>

      <div className="choose-cards">
        {/* Upload Card */}
        <div className="choose-card" onClick={() => navigate("/upload")}>
          <div className="choose-card-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h2 className="choose-card-title">Upload Image</h2>
          <p className="choose-card-desc">
            Select a leaf image from your device to analyze plant disease.
          </p>
          <span className="choose-card-arrow">→</span>
        </div>

        {/* Camera Card */}
        <div className="choose-card" onClick={() => navigate("/camera")}>
          <div className="choose-card-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <h2 className="choose-card-title">Use Camera</h2>
          <p className="choose-card-desc">
            Capture a real-time image of the leaf using your camera.
          </p>
          <span className="choose-card-arrow">→</span>
        </div>
      </div>
    </div>
  );
}

export default Choose;
