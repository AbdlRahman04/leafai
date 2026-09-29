import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDashboardData } from "../services/dashboardService";
import ReportPreview from "../components/ReportPreview";
import "./Report.css";

const REPORTS_PER_PAGE = 10;

function getReportDate(report) {
  return String(report.timestamp || report.date || "").slice(0, 10);
}

function formatReportDate(report) {
  const value = report.timestamp || report.date;
  if (!value) return "Date unavailable";

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function Report() {
  const [reports, setReports] = useState([]);
  const [modelAccuracy, setModelAccuracy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");
  const [plant, setPlant] = useState("");
  const [disease, setDisease] = useState("");
  const [page, setPage] = useState(1);
  const [selectedReport, setSelectedReport] = useState(null);

  const loadReports = useCallback(async (isRetry = false) => {
    if (isRetry) {
      setLoading(true);
      setError("");
    }
    try {
      const data = await fetchDashboardData();
      const history = Array.isArray(data.scan_history) ? data.scan_history : [];
      setReports(history);
      setModelAccuracy(data.accuracy ?? null);
    } catch (loadError) {
      console.error(loadError);
      setError("Unable to load scan reports. Check that the backend is running, then try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const plantOptions = useMemo(
    () => [...new Set(reports.map((report) => report.plant).filter(Boolean))].sort(),
    [reports],
  );
  const diseaseOptions = useMemo(
    () => [...new Set(reports.map((report) => report.disease).filter(Boolean))].sort(),
    [reports],
  );

  const filteredReports = useMemo(() => reports
    .filter((report) => !date || getReportDate(report) === date)
    .filter((report) => !plant || report.plant === plant)
    .filter((report) => !disease || report.disease === disease)
    .sort((a, b) => new Date(b.timestamp || b.date || 0) - new Date(a.timestamp || a.date || 0)),
  [date, disease, plant, reports]);

  const pageCount = Math.max(1, Math.ceil(filteredReports.length / REPORTS_PER_PAGE));
  const visibleReports = filteredReports.slice((page - 1) * REPORTS_PER_PAGE, page * REPORTS_PER_PAGE);
  const firstVisibleReport = filteredReports.length === 0 ? 0 : (page - 1) * REPORTS_PER_PAGE + 1;
  const lastVisibleReport = Math.min(page * REPORTS_PER_PAGE, filteredReports.length);
  const hasFilters = Boolean(date || plant || disease);

  return (
    <div className="page-container">
      <h1 className="page-title">Analysis Reports</h1>
      <p className="page-subtitle">
        Review past scans, filter results, and download a detailed PDF report.
      </p>

      <div className="report-toolbar">
        <div className="report-filters" aria-label="Filter reports">
          <label className="report-filter-label">
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => { setDate(event.target.value); setPage(1); }}
              className="report-filter"
            />
          </label>

          <label className="report-filter-label">
            <span>Plant</span>
            <select
              value={plant}
              onChange={(event) => { setPlant(event.target.value); setPage(1); }}
              className="report-filter"
            >
              <option value="">All plants</option>
              {plantOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label className="report-filter-label">
            <span>Condition</span>
            <select
              value={disease}
              onChange={(event) => { setDisease(event.target.value); setPage(1); }}
              className="report-filter"
            >
              <option value="">All conditions</option>
              {diseaseOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <div className="report-list-meta" aria-live="polite">
          {loading ? "Loading scans…" : `${filteredReports.length} ${filteredReports.length === 1 ? "report" : "reports"}`}
          {hasFilters && (
            <button
              type="button"
              className="report-clear-filters"
              onClick={() => { setDate(""); setPlant(""); setDisease(""); setPage(1); }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="report-empty ui-empty-state" role="status">
          <strong>Loading reports</strong>
          <p>Retrieving your scan history.</p>
        </div>
      ) : error ? (
        <div className="report-empty ui-empty-state" role="alert">
          <strong>Reports are unavailable</strong>
          <p>{error}</p>
          <button type="button" className="report-retry-button" onClick={() => loadReports(true)}>Try again</button>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="report-empty ui-empty-state">
          <span className="ui-empty-mark" aria-hidden="true">⌕</span>
          <strong>{reports.length === 0 ? "No scans yet" : "No reports match these filters"}</strong>
          <p>{reports.length === 0
            ? "Complete a plant scan and it will appear here."
            : "Try changing or clearing your filters."}</p>
        </div>
      ) : (
        <div className="report-list">
          {visibleReports.map((report) => (
            <button
              type="button"
              key={report.id || report.timestamp}
              className="report-card"
              onClick={() => setSelectedReport(report)}
              aria-label={`Open report for ${report.plant || "plant"}: ${report.disease || "unknown condition"}`}
            >
              <span className="report-accent-bar" aria-hidden="true" />
              <span className="report-card-body">
                <span className="report-card-date">{formatReportDate(report)}</span>
                <span className="report-card-plant">{report.plant || "Unknown plant"}</span>
                <span className="report-card-disease">{report.disease || "Condition unavailable"}</span>
              </span>
              <span className="report-card-result">
                <span className="report-card-confidence">{Number(report.confidence || 0)}%</span>
                <span className="report-card-action">View report <span aria-hidden="true">→</span></span>
              </span>
            </button>
          ))}
        </div>
      )}

      {!loading && !error && filteredReports.length > 0 && (
        <nav className="report-pagination" aria-label="Report pages">
          <span className="report-pagination-summary">
            Showing {firstVisibleReport}–{lastVisibleReport} of {filteredReports.length}
          </span>
          <div className="report-pagination-controls">
            <button
              type="button"
              className="report-page-button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={page === 1}
              aria-label="Go to previous report page"
            >
              Previous
            </button>
            <span className="report-page-indicator" aria-live="polite">Page {page} of {pageCount}</span>
            <button
              type="button"
              className="report-page-button"
              onClick={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))}
              disabled={page === pageCount}
              aria-label="Go to next report page"
            >
              Next
            </button>
          </div>
        </nav>
      )}

      {selectedReport && (
        <ReportPreview
          prediction={selectedReport}
          modelAccuracy={modelAccuracy}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}

export default Report;
