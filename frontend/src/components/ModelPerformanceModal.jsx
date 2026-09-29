import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fetchDashboardData } from "../services/dashboardService";
import "./ModelPerformanceModal.css";

function ModelPerformanceModal({ onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDashboardData()
      .then((json) => setData(json))
      .catch((err) => {
        console.error(err);
        setError("Unable to load model performance right now.");
      });
  }, []);

  if (error) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>✕</button>
          <h2 className="modal-title">Model Performance</h2>
          <p className="modal-error">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="modal-overlay">
        <div className="modal-container">
          <div className="modal-loading">Loading performance data...</div>
        </div>
      </div>
    );
  }

  const severityData = Object.entries(data.severity_distribution || {}).map(
    ([key, value]) => ({ name: key, value })
  );

  const confidenceData = Object.entries(data.confidence_distribution || {}).map(
    ([key, value]) => ({ range: key, count: value })
  );

  const confusionMatrix = Array.isArray(data.confusion_matrix)
    ? data.confusion_matrix
    : [];

  const COLORS = ["#b8514a", "#b98448", "#6e9872"];

  const customTooltipStyle = {
    backgroundColor: "#fffefa",
    border: "1px solid #d9ddd5",
    borderRadius: "8px",
    padding: "8px 14px",
    color: "#17211b",
    fontSize: "13px",
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <h2 className="modal-title">Model Performance</h2>

        {/* Accuracy KPI */}
        <div className="modal-kpi">
          <div className="modal-kpi-label">Overall Accuracy</div>
          <div className="modal-kpi-value">
            {typeof data.accuracy === "number" ? `${data.accuracy}%` : "N/A"}
          </div>
          <div className="modal-kpi-sub">
            {data.total_predictions || 0} total predictions
          </div>
        </div>

        {/* Charts */}
        <div className="modal-charts">
          {/* Confusion Matrix */}
          <div className="modal-chart-card">
            <h4 className="modal-chart-title">Confusion Matrix</h4>
            <div className="modal-cm-container">
              {confusionMatrix.length === 0 ? (
                <p className="modal-chart-empty">
                  Confusion matrix not available yet.
                </p>
              ) : (
                confusionMatrix.map((row, rowIndex) => (
                  <div key={rowIndex} className="modal-cm-row">
                    {row.map((value, colIndex) => (
                      <div
                        key={colIndex}
                        className="modal-cm-cell"
                        style={{
                          backgroundColor: `rgba(76, 175, 80, ${
                            Math.max(...row) > 0
                              ? value / Math.max(...row)
                              : 0
                          })`,
                        }}
                      >
                        {value}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Severity Distribution */}
          <div className="modal-chart-card">
            <h4 className="modal-chart-title">Severity Distribution</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={severityData}
                  dataKey="value"
                  outerRadius={80}
                  innerRadius={40}
                  stroke="#fffefa"
                >
                  {severityData.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend
                  wrapperStyle={{ color: "#667168", fontSize: "13px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Confidence Distribution */}
          <div className="modal-chart-card">
            <h4 className="modal-chart-title">Confidence Distribution</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={confidenceData}>
                <XAxis
                  dataKey="range"
                  stroke="#d9ddd5"
                  tick={{ fill: "#667168", fontSize: 12 }}
                />
                <YAxis
                  stroke="#d9ddd5"
                  tick={{ fill: "#667168", fontSize: 12 }}
                />
                <Tooltip contentStyle={customTooltipStyle} />
                <Bar dataKey="count" fill="#6e9872" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModelPerformanceModal;
