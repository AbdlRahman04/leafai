import { useMemo, useState } from "react";
import { PLANTS, DISEASES } from "../utils/constants";
import "./Report.css";

function Report() {
  const [reports] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("reports"));
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });

  const [date, setDate] = useState("");
  const [plant, setPlant] = useState("");
  const [disease, setDisease] = useState("");

  const filteredReports = useMemo(() => {
    let data = [...reports];

    if (date) data = data.filter((r) => r.date === date);
    if (plant) data = data.filter((r) => r.plant === plant);
    if (disease) data = data.filter((r) => r.disease === disease);

    return data;
  }, [date, plant, disease, reports]);

  return (
    <div className="page-container">
      <h1 className="page-title">Analysis Reports</h1>
      <p className="page-subtitle">
        Review your past plant disease analysis results
      </p>

      {/* Filters */}
      <div className="report-filters">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="report-filter"
        />

        <select
          value={plant}
          onChange={(e) => setPlant(e.target.value)}
          className="report-filter"
        >
          <option value="">All Plants</option>
          {PLANTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          value={disease}
          onChange={(e) => setDisease(e.target.value)}
          className="report-filter"
        >
          <option value="">All Diseases</option>
          {DISEASES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Report List */}
      {filteredReports.length === 0 ? (
        <div className="report-empty ui-empty-state">
          <span className="ui-empty-mark" aria-hidden="true">⌁</span>
          <strong>No reports found</strong>
          <p>Generated reports will appear here when they are available on this device.</p>
        </div>
      ) : (
        <div className="report-list">
          {filteredReports.map((r, i) => (
            <div key={i} className="report-card">
              <div className="report-accent-bar" />

              <div className="report-card-body">
                <div className="report-card-date">{r.date}</div>
                <div className="report-card-plant">{r.plant}</div>
                <div className="report-card-disease">{r.disease}</div>
              </div>

              <div className="report-card-confidence">{r.confidence}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Report;
