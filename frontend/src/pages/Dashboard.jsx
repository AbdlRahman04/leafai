import { useEffect, useMemo, useState } from "react";
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
import {
  deleteAnalysisRun,
  deletePrediction,
  deletePredictions,
  fetchAutomationAlerts,
  fetchAutomationConfig,
  fetchAutomationStatus,
  fetchDashboardData,
  markAutomationAlertRead,
  runAutomationNow,
  updateAutomationConfig,
} from "../services/dashboardService";
import ModelPerformanceModal from "../components/ModelPerformanceModal";
import ReportPreview from "../components/ReportPreview";
import DeleteConfirmationDialog from "../components/DeleteConfirmationDialog";
import "./Dashboard.css";

const SEVERITY_COLORS = ["#b8514a", "#b98448", "#6e9872"];
const PLANT_COLORS = [
  "#143d2b", "#6e9872", "#b98448", "#8ba67f", "#b8514a",
  "#5c8771", "#a97768", "#91775e", "#7f9084", "#c7a962",
  "#536f5c", "#749b83", "#a4b879", "#c47a4e",
];

function DashboardTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const subject = label ?? item?.payload?.name ?? item?.name ?? "Scan data";
  const metric = item?.name && !["count", "value"].includes(item.name) && item.name !== subject
    ? item.name
    : "Scans";

  return (
    <div className="dash-chart-tooltip">
      <span>{subject}</span>
      <strong>{Number(item?.value ?? 0).toLocaleString()} {metric.toLowerCase()}</strong>
    </div>
  );
}

function TrendIndicator({ value, label = "vs previous run" }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="dash-kpi-trend neutral">— {label}</span>;
  }

  const rounded = Math.abs(value) < 0.1 ? 0 : value;
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "neutral";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  return <span className={`dash-kpi-trend ${direction}`}>{arrow} {rounded > 0 ? "+" : ""}{rounded.toFixed(1)}% {label}</span>;
}

function formatAutomationTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataWarning, setDataWarning] = useState("");
  const [selectedScan, setSelectedScan] = useState(null);
  const [showModelPerformance, setShowModelPerformance] = useState(false);
  const [reportPrediction, setReportPrediction] = useState(null);
  const [dateRange, setDateRange] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [plantFilter, setPlantFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [runFilter, setRunFilter] = useState("all");
  const [currentTime] = useState(() => Date.now());
  const [showAllScans, setShowAllScans] = useState(false);
  const [selectedScanIds, setSelectedScanIds] = useState([]);
  const [automationConfig, setAutomationConfig] = useState(null);
  const [automationStatus, setAutomationStatus] = useState(null);
  const [automationAlerts, setAutomationAlerts] = useState([]);
  const [automationError, setAutomationError] = useState("");
  const [automationSaving, setAutomationSaving] = useState(false);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationExpanded, setAutomationExpanded] = useState(false);
  const [totalScansExpanded, setTotalScansExpanded] = useState(true);
  const [deleteRequest, setDeleteRequest] = useState(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleDeleteScan = (event, prediction) => {
    event.stopPropagation();
    if (!prediction.id) return;
    setDeleteError("");
    setDeleteRequest({
      type: "scan",
      prediction,
      title: "Remove this scan?",
      description: `This will permanently remove the ${prediction.plant || "selected"} ${prediction.disease || "scan"} record from your dashboard. This cannot be undone.`,
      actionLabel: "Remove scan",
    });
  };

  const handleDeleteSelected = () => {
    if (!selectedScanIds.length) return;
    setDeleteError("");
    setDeleteRequest({
      type: "selected",
      ids: selectedScanIds,
      title: `Remove ${selectedScanIds.length} selected scan${selectedScanIds.length === 1 ? "" : "s"}?`,
      description: "These scan records will be permanently removed from your dashboard. This cannot be undone.",
      actionLabel: `Remove ${selectedScanIds.length} scan${selectedScanIds.length === 1 ? "" : "s"}`,
    });
  };

  const handleDeleteRun = () => {
    const run = runOptions.find((item) => item.run_key === runFilter);
    if (!run) return;
    setDeleteError("");
    setDeleteRequest({
      type: "run",
      run,
      title: "Delete this analysis run?",
      description: `${run.run_label} and all ${run.image_count} scan${run.image_count === 1 ? "" : "s"} in it will be permanently removed. This cannot be undone.`,
      actionLabel: "Delete run",
    });
  };

  const confirmDelete = async () => {
    if (!deleteRequest || deletePending) return;
    setDeletePending(true);
    setDeleteError("");
    try {
      if (deleteRequest.type === "scan") {
        const { prediction } = deleteRequest;
        await deletePrediction(prediction.id);
        setSelectedScanIds((ids) => ids.filter((id) => id !== prediction.id));
        if (selectedScan?.id === prediction.id) setSelectedScan(null);
      } else if (deleteRequest.type === "selected") {
        await deletePredictions(deleteRequest.ids);
        setSelectedScanIds([]);
        setSelectedScan(null);
      } else if (deleteRequest.type === "run") {
        await deleteAnalysisRun(deleteRequest.run.run_key);
        setRunFilter("all");
        setSelectedScanIds([]);
        setSelectedScan(null);
      }
      setData(await fetchDashboardData());
    } catch (deleteError) {
      console.error(deleteError);
      setDeleteError(deleteError.message || "Unable to remove this data. Check that the backend is running and try again.");
      return;
    } finally {
      setDeletePending(false);
    }
    setDeleteRequest(null);
  };

  useEffect(() => {
    let cancelled = false;
    const loadDashboard = () => fetchDashboardData()
      .then((json) => {
        if (cancelled) return;
        const historyCount = Array.isArray(json.scan_history) ? json.scan_history.length : 0;
        const totalCount = Number(json.total_predictions);
        if (Number.isFinite(totalCount) && historyCount !== totalCount) {
          const warning = `Dashboard data mismatch: API reports ${totalCount} saved scans but returned ${historyCount}.`;
          console.warn(warning);
          setDataWarning(warning);
        } else {
          setDataWarning("");
        }
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError("Unable to load dashboard data. Make sure the backend is running.");
        setLoading(false);
      });

    loadDashboard();
    const refreshTimer = window.setInterval(loadDashboard, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, []);

  const loadAutomation = async () => {
    try {
      const [config, status, alerts] = await Promise.all([
        fetchAutomationConfig(),
        fetchAutomationStatus(),
        fetchAutomationAlerts(),
      ]);
      setAutomationConfig(config);
      setAutomationStatus(status);
      setAutomationAlerts(alerts.alerts || []);
      setAutomationError("");
    } catch (automationLoadError) {
      console.error(automationLoadError);
      setAutomationError("Automation service data is unavailable. Make sure the backend is running.");
    }
  };

  useEffect(() => {
    loadAutomation();
    const refreshTimer = window.setInterval(loadAutomation, 15000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  const saveAutomation = async (changes) => {
    if (!automationConfig) return;
    setAutomationSaving(true);
    try {
      const saved = await updateAutomationConfig({ ...automationConfig, ...changes });
      setAutomationConfig(saved);
      setAutomationError("");
      await loadAutomation();
    } catch (automationSaveError) {
      console.error(automationSaveError);
      setAutomationError(automationSaveError.message || "Unable to save automation settings.");
    } finally {
      setAutomationSaving(false);
    }
  };

  const handleRunAutomationNow = async () => {
    setAutomationRunning(true);
    try {
      await runAutomationNow();
      setAutomationError("Scan request queued. The background service will capture the camera shortly.");
      window.setTimeout(loadAutomation, 2500);
    } catch (automationRunError) {
      setAutomationError(automationRunError.message || "Unable to queue an automated scan.");
    } finally {
      setAutomationRunning(false);
    }
  };

  const handleReadAutomationAlert = async (alertId) => {
    try {
      await markAutomationAlertRead(alertId);
      setAutomationAlerts((alerts) => alerts.map((alert) => alert.id === alertId ? { ...alert, read: true } : alert));
    } catch (alertError) {
      setAutomationError(alertError.message || "Unable to update alert.");
    }
  };

  const allScans = useMemo(() => (Array.isArray(data?.scan_history) ? data.scan_history : []), [data]);
  const plantOptions = [...new Set(allScans.map((scan) => scan.plant).filter(Boolean))].sort();
  const runOptions = data?.runs || [];

  const filteredScans = useMemo(() => {
    const rangeDays = dateRange === "7" ? 7 : dateRange === "30" ? 30 : null;

    return allScans.filter((scan) => {
      const scanTime = new Date(scan.timestamp).getTime();
      const inDateRange = !rangeDays || (
        Number.isFinite(scanTime) && currentTime - scanTime <= rangeDays * 24 * 60 * 60 * 1000
      );
      const matchesSeverity = severityFilter === "all" || scan.severity === severityFilter;
      const matchesPlant = plantFilter === "all" || scan.plant === plantFilter;
      const matchesConfidence = confidenceFilter === "all"
        || (confidenceFilter === "review" && scan.needs_review)
        || (confidenceFilter === "high" && scan.confidence >= 85);
      const matchesRun = runFilter === "all" || scan.run_key === runFilter;
      return inDateRange && matchesSeverity && matchesPlant && matchesConfidence && matchesRun;
    });
  }, [allScans, confidenceFilter, currentTime, dateRange, plantFilter, runFilter, severityFilter]);

  const dashboardMetrics = useMemo(() => {
    const severityCounts = { High: 0, Moderate: 0, None: 0 };
    const confidenceCounts = { "0-70": 0, "70-85": 0, "85-100": 0 };
    const plants = {};
    const diseases = {};
    let healthy = 0;

    filteredScans.forEach((scan) => {
      if (severityCounts[scan.severity] !== undefined) severityCounts[scan.severity] += 1;
      if (scan.confidence < 70) confidenceCounts["0-70"] += 1;
      else if (scan.confidence < 85) confidenceCounts["70-85"] += 1;
      else confidenceCounts["85-100"] += 1;
      plants[scan.plant] = (plants[scan.plant] || 0) + 1;
      if (scan.disease?.toLowerCase() === "healthy") healthy += 1;
      else diseases[scan.disease] = (diseases[scan.disease] || 0) + 1;
    });

    const sortedEntries = (values) => Object.entries(values).sort((a, b) => b[1] - a[1]);
    const total = filteredScans.length;
    const highSeverity = severityCounts.High;
    const needsReview = filteredScans.filter((scan) => scan.needs_review).length;
    const highConfidence = filteredScans.filter((scan) => scan.confidence >= 85).length;
    const mostCommonPlant = sortedEntries(plants)[0];
    const mostCommonDisease = sortedEntries(diseases)[0];

    return {
      total,
      severityData: Object.entries(severityCounts).map(([name, value]) => ({ name, value })),
      confidenceData: Object.entries(confidenceCounts).map(([range, count]) => ({ range, count })),
      plantData: sortedEntries(plants).map(([name, value]) => ({ name, value })).slice(0, 8),
      diseaseData: sortedEntries(diseases).map(([name, count]) => ({ name, count })).slice(0, 8),
      healthyVsDiseased: [{ name: "Scans", healthy, diseased: total - healthy }],
      avgConfidence: total ? (filteredScans.reduce((sum, scan) => sum + scan.confidence, 0) / total).toFixed(2) : null,
      highSeverity,
      needsReview,
      highConfidence,
      highConfidencePercentage: total ? ((highConfidence / total) * 100).toFixed(1) : 0,
      mostCommonPlant,
      mostCommonDisease,
    };
  }, [filteredScans]);

  const totalPredictions = dashboardMetrics.total;
  const isEmpty = allScans.length === 0;
  const recentPredictions = [...filteredScans].reverse();
  const displayedScans = showAllScans ? recentPredictions : recentPredictions.slice(0, 5);
  const displayedScanIds = displayedScans.map((scan) => scan.id).filter(Boolean);
  const allDisplayedSelected = displayedScanIds.length > 0 && displayedScanIds.every((id) => selectedScanIds.includes(id));
  const unreadAutomationAlerts = automationAlerts.filter((alert) => !alert.read).length;

  const runTrends = useMemo(() => {
    const grouped = {};
    allScans.forEach((scan) => {
      if (!scan.run_key) return;
      if (!grouped[scan.run_key]) grouped[scan.run_key] = [];
      if (scan.run_number != null) grouped[scan.run_key].push(scan);
    });
    const orderedRuns = Object.entries(grouped)
      .map(([key, scans]) => ({ key, scans, number: scans[0]?.run_number || 0 }))
      .sort((a, b) => b.number - a.number);
    const currentIndex = runFilter === "all" ? 0 : orderedRuns.findIndex((run) => run.key === runFilter);
    const current = orderedRuns[currentIndex >= 0 ? currentIndex : 0];
    const previous = orderedRuns[(currentIndex >= 0 ? currentIndex : 0) + 1];
    const percentChange = (currentValue, previousValue) => {
      if (!previousValue || !Number.isFinite(currentValue) || !Number.isFinite(previousValue)) return null;
      return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
    };
    const averageConfidence = (scans) => scans?.length
      ? scans.reduce((sum, scan) => sum + Number(scan.confidence || 0), 0) / scans.length
      : null;
    return {
      total: percentChange(current?.scans.length, previous?.scans.length),
      confidence: percentChange(averageConfidence(current?.scans), averageConfidence(previous?.scans)),
    };
  }, [allScans, runFilter]);

  if (loading) {
    return (
      <div className="page-container dash-page">
        <div className="dash-loading">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container dash-page">
        <header className="dash-header">
          <h1 className="page-title dash-title">Analytics Dashboard</h1>
        </header>
        <div className="dash-empty-state">
          <div className="dash-empty-text">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container dash-page">
      <header className="dash-header">
        <div className="dash-header-main">
          <h1 className="page-title dash-title">Analytics Dashboard</h1>
          <p className="page-subtitle dash-subtitle">
            Model performance and prediction analytics
          </p>
          <button
            className="dash-refresh-button"
            type="button"
            onClick={() => window.location.reload()}
            aria-label="Refresh dashboard page"
            title="Refresh dashboard"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M13 4.5V1.8m0 0h-2.7m2.7 0-2 2a5.5 5.5 0 1 0 1.3 4.4" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </header>

      <section className={`automation-panel ${automationExpanded ? "" : "is-collapsed"}`} aria-labelledby="automation-heading">
        <div className="automation-panel-heading">
          <div>
            <span className="dash-section-eyebrow">Background monitoring</span>
            <h2 id="automation-heading">Automated Camera Scans</h2>
          </div>
          <div className="automation-heading-actions">
            <span className={`automation-status ${automationStatus?.service_state || "stopped"}`}>
              {automationStatus?.service_state || "stopped"}
            </span>
            <button
              className="automation-collapse-button"
              type="button"
              onClick={() => setAutomationExpanded((expanded) => !expanded)}
              aria-expanded={automationExpanded}
              aria-controls="automation-panel-content"
              aria-label={automationExpanded ? "Minimize automated camera scans" : "Maximize automated camera scans"}
              title={automationExpanded ? "Minimize" : "Maximize"}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="m3 4.5 3 3 3-3" />
              </svg>
            </button>
          </div>
        </div>

        {!automationExpanded && (
          <div className="automation-collapsed-summary" aria-label="Automation summary">
            <span className="automation-summary-item">
              <span className="automation-summary-label">Next scan</span>
              <strong>{formatAutomationTime(automationStatus?.next_run_at)}</strong>
            </span>
            <span className="automation-summary-item">
              <span className="automation-summary-label">Alerts</span>
              <strong>{unreadAutomationAlerts ? `${unreadAutomationAlerts} unread` : "All clear"}</strong>
            </span>
          </div>
        )}

        {automationExpanded && <div id="automation-panel-content">
        {automationConfig ? (
          <div className="automation-controls">
            <label className="automation-toggle">
              <input
                type="checkbox"
                checked={automationConfig.enabled}
                disabled={automationSaving}
                onChange={(event) => saveAutomation({ enabled: event.target.checked })}
              />
              <span className="automation-switch" aria-hidden="true" />
              <span>Enable scheduled monitoring</span>
            </label>
            <label className="automation-field"><span>Every</span>
              <span className="automation-input-with-unit">
                <input
                  type="number"
                  min="1"
                  max="10080"
                  value={automationConfig.interval_minutes}
                  disabled={automationSaving}
                  onChange={(event) => setAutomationConfig((config) => ({ ...config, interval_minutes: Number(event.target.value) }))}
                  onBlur={() => saveAutomation({ interval_minutes: automationConfig.interval_minutes })}
                />
                <small>min</small>
              </span>
            </label>
            <label className="automation-field"><span>Camera</span>
              <input
                type="number"
                min="0"
                max="10"
                value={automationConfig.camera_index}
                disabled={automationSaving}
                onChange={(event) => setAutomationConfig((config) => ({ ...config, camera_index: Number(event.target.value) }))}
                onBlur={() => saveAutomation({ camera_index: automationConfig.camera_index })}
              />
            </label>
            <label className="automation-field automation-field-plant"><span>Plant label</span>
              <input
                type="text"
                maxLength="80"
                value={automationConfig.plant_label}
                disabled={automationSaving}
                onChange={(event) => setAutomationConfig((config) => ({ ...config, plant_label: event.target.value }))}
                onBlur={() => saveAutomation({ plant_label: automationConfig.plant_label })}
              />
            </label>
            <button className="automation-run-button" type="button" onClick={handleRunAutomationNow} disabled={automationRunning}>
              <span className="automation-run-icon" aria-hidden="true">↻</span>
              {automationRunning ? "Queuing scan..." : "Run scan now"}
            </button>
          </div>
        ) : <p className="automation-loading">Loading automation controls…</p>}

        <div className="automation-meta">
          <span className="automation-meta-item"><span>Last success</span><strong>{formatAutomationTime(automationStatus?.last_success_at)}</strong></span>
          <span className="automation-meta-item"><span>Next scan</span><strong>{formatAutomationTime(automationStatus?.next_run_at)}</strong></span>
          {automationStatus?.last_error && <span className="automation-error"><span>Last error</span> {automationStatus.last_error}</span>}
        </div>
        {automationError && <p className="automation-message" role="status">{automationError}</p>}

        <div className="automation-alerts">
          <div className="automation-alerts-heading">
            <h3>Alerts</h3>
            {unreadAutomationAlerts > 0 && <span className="automation-alert-count">{unreadAutomationAlerts} unread</span>}
          </div>
          {automationAlerts.length ? (
            <div className="automation-alert-list">
              {automationAlerts.slice(0, 5).map((alert) => (
                <article key={alert.id} className={`automation-alert ${alert.severity || "warning"} ${alert.read ? "read" : "unread"}`}>
                  <span className="automation-alert-icon" aria-hidden="true">{alert.severity === "error" ? "!" : "i"}</span>
                  <div className="automation-alert-content">
                    <div className="automation-alert-title-row">
                      <strong>{alert.title}</strong>
                      <span className="automation-alert-state">{alert.read ? "Read" : "Unread"}</span>
                    </div>
                    <p>{alert.message}</p>
                    <time>{formatAutomationTime(alert.created_at)}</time>
                  </div>
                  {!alert.read && <button type="button" className="automation-alert-action" onClick={() => handleReadAutomationAlert(alert.id)}>Mark read</button>}
                </article>
              ))}
            </div>
          ) : <p className="automation-no-alerts">No automated-monitoring alerts.</p>}
        </div>
        </div>}
      </section>

      {isEmpty ? (
        <div className="dash-empty-state">
          <div className="dash-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
            </svg>
          </div>
          <div className="dash-empty-text">No predictions yet</div>
          <div className="dash-empty-hint">
            Upload or capture a leaf image to start generating analytics
          </div>
        </div>
      ) : (
        <div className="dash-body">
          {dataWarning && <div className="dash-data-warning" role="status">{dataWarning}</div>}
          {/* KPI Row */}
          <div className="dash-kpis">
            <div className="dash-kpi-card">
              <div className="dash-kpi-label">Model Accuracy</div>
              <div className="dash-kpi-value green">
                {data.accuracy != null ? `${data.accuracy}%` : "N/A"}
              </div>
              <div className="dash-kpi-sub" title="Accuracy is measured on the model validation dataset.">
                validation set{data.validation_sample_count ? ` · ${data.validation_sample_count} images` : ""}
                {data.model_evaluated_at ? ` · ${new Date(data.model_evaluated_at).toLocaleDateString()}` : ""}
              </div>
            </div>
            <div className="dash-kpi-card">
              <div className="dash-kpi-label">Avg Confidence</div>
              <div className="dash-kpi-value amber">
                {data.avg_confidence ? `${data.avg_confidence}%` : "—"}
              </div>
              <div className="dash-kpi-sub">across all scans</div>
              <TrendIndicator value={runTrends.confidence} label="vs previous run" />
            </div>
            <div className="dash-kpi-card">
              <div className="dash-kpi-label">High Severity</div>
              <div className="dash-kpi-value red">
                {data.high_severity_count || 0}
              </div>
              <div className="dash-kpi-sub">critical detections</div>
            </div>
            <div className={`dash-kpi-card dash-kpi-card-primary ${totalScansExpanded ? "" : "is-collapsed"}`}>
              <div className="dash-kpi-heading">
                <div className="dash-kpi-label">Total Scans</div>
                <button
                  type="button"
                  className="dash-kpi-toggle"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setTotalScansExpanded((expanded) => !expanded)}
                  aria-expanded={totalScansExpanded}
                  aria-controls="total-scans-kpi-details"
                  aria-label={totalScansExpanded ? "Collapse Total Scans details" : "Expand Total Scans details"}
                  title={totalScansExpanded ? "Collapse details" : "Expand details"}
                >
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M3 4.5 6 7.5 9 4.5" />
                  </svg>
                </button>
              </div>
              <div className="dash-kpi-value blue">{totalPredictions}</div>
              {totalScansExpanded && (
                <div id="total-scans-kpi-details" className="dash-kpi-details">
                  <div className="dash-kpi-sub">all-time predictions</div>
                  <TrendIndicator value={runTrends.total} />
                </div>
              )}
            </div>
          </div>

          <div className="dash-insights-card">
            <div className="dash-insights-heading">
              <div>
                <span className="dash-section-eyebrow">Decision support</span>
                <h3>Key Insights</h3>
              </div>
            </div>
            <div className="dash-insights-grid">
              <div className="dash-insight-item">
                <span className="dash-insight-value">{dashboardMetrics.mostCommonPlant?.[0] || "—"}</span>
                <span className="dash-insight-label">most scanned plant{dashboardMetrics.mostCommonPlant ? ` · ${Math.round((dashboardMetrics.mostCommonPlant[1] / Math.max(totalPredictions, 1)) * 100)}%` : ""}</span>
              </div>
              <div className="dash-insight-item">
                <span className="dash-insight-value">{dashboardMetrics.mostCommonDisease?.[0] || "—"}</span>
                <span className="dash-insight-label">most frequent disease</span>
              </div>
              <div className="dash-insight-item">
                <span className="dash-insight-value">{totalPredictions ? `${Math.round((dashboardMetrics.highSeverity / totalPredictions) * 100)}%` : "—"}</span>
                <span className="dash-insight-label">high-severity scans</span>
              </div>
              <div className="dash-insight-item">
                <span className="dash-insight-value">{dashboardMetrics.highConfidencePercentage}%</span>
                <span className="dash-insight-label">high-confidence scans</span>
              </div>
            </div>
            {totalPredictions > 0 && totalPredictions < 30 && (
              <div className="dash-small-sample-notice">
                Early signal: {totalPredictions} scan{totalPredictions === 1 ? "" : "s"} is a small sample, so trends should be interpreted cautiously.
              </div>
            )}
          </div>

          <div className="dash-filter-bar" aria-label="Dashboard filters">
            <div className="dash-filter-title">Filter insights</div>
            <label>Period<select value={dateRange} onChange={(event) => setDateRange(event.target.value)}><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>
            <label>Severity<select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}><option value="all">All severities</option><option value="High">High</option><option value="Moderate">Moderate</option><option value="None">None</option></select></label>
            <label>Plant<select value={plantFilter} onChange={(event) => setPlantFilter(event.target.value)}><option value="all">All plants</option>{plantOptions.map((plant) => <option key={plant} value={plant}>{plant}</option>)}</select></label>
            <label>Confidence<select value={confidenceFilter} onChange={(event) => setConfidenceFilter(event.target.value)}><option value="all">All confidence</option><option value="review">Needs review</option><option value="high">High confidence</option></select></label>
            <label>Run<select value={runFilter} onChange={(event) => setRunFilter(event.target.value)}><option value="all">All runs</option>{runOptions.map((run) => <option key={run.run_key} value={run.run_key}>{run.run_label} ({run.image_count})</option>)}</select></label>
            {runFilter !== "all" && <button className="dash-danger-action" onClick={handleDeleteRun}>Delete Run</button>}
            {selectedScanIds.length > 0 && <button className="dash-danger-action" onClick={handleDeleteSelected}>Delete Selected ({selectedScanIds.length})</button>}
            <button className="dash-clear-filters" onClick={() => { setDateRange("all"); setSeverityFilter("all"); setPlantFilter("all"); setConfidenceFilter("all"); setRunFilter("all"); }}>Clear</button>
          </div>

          {/* Charts Row 1 */}
          <div className="dash-charts">
            {/* Disease Frequency */}
            <div className="dash-chart-card">
              <h4 className="dash-chart-title">Disease Frequency</h4>
              {dashboardMetrics.diseaseData.length === 0 ? (
                <div className="dash-chart-empty">No diseases detected yet</div>
              ) : (
                <div className="dash-chart-body">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={dashboardMetrics.diseaseData} layout="vertical" margin={{ left: 20, top: 4, right: 8, bottom: 4 }} accessibilityLayer={false}>
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      domain={[0, "dataMax"]}
                      stroke="#d9ddd5"
                      tick={{ fill: "#667168", fontSize: 12 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      stroke="#d9ddd5"
                      tick={{ fill: "#667168", fontSize: 12 }}
                    />
                    <Tooltip content={<DashboardTooltip />} cursor={{ fill: "rgba(110, 152, 114, 0.12)" }} />
                    <Bar dataKey="count" fill="#6e9872" radius={[0, 6, 6, 0]} />
                  </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Plant Distribution */}
            <div className="dash-chart-card">
              <h4 className="dash-chart-title">Plant Distribution</h4>
              {dashboardMetrics.plantData.length === 0 ? (
                <div className="dash-chart-empty">No data yet</div>
              ) : (
                <div className="dash-chart-body">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={dashboardMetrics.plantData} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }} accessibilityLayer={false}>
                    <XAxis type="number" allowDecimals={false} stroke="#d9ddd5" tick={{ fill: "#667168", fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={90} stroke="#d9ddd5" tick={{ fill: "#667168", fontSize: 11 }} />
                    <Tooltip content={<DashboardTooltip />} cursor={{ fill: "rgba(110, 152, 114, 0.12)" }} />
                    <Bar dataKey="value" name="Scans" fill="#143d2b" radius={[0, 6, 6, 0]} />
                  </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Severity Breakdown */}
            <div className="dash-chart-card">
              <h4 className="dash-chart-title">Severity Breakdown</h4>
              <div className="dash-chart-body">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart accessibilityLayer={false}>
                  <Pie
                    data={dashboardMetrics.severityData}
                    dataKey="value"
                    outerRadius="72%"
                    innerRadius="42%"
                    stroke="#fffefa"
                  >
                    {dashboardMetrics.severityData.map((_, index) => (
                      <Cell key={index} fill={SEVERITY_COLORS[index % SEVERITY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<DashboardTooltip />} cursor={false} />
                  <Legend
                    wrapperStyle={{ color: "#667168", fontSize: "12px" }}
                  />
                </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Confidence Distribution */}
            <div className="dash-chart-card">
              <h4 className="dash-chart-title">Confidence Distribution</h4>
              <div className="dash-chart-body">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={dashboardMetrics.confidenceData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} accessibilityLayer={false}>
                  <XAxis
                    dataKey="range"
                    stroke="#d9ddd5"
                    tick={{ fill: "#667168", fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#d9ddd5"
                    tick={{ fill: "#667168", fontSize: 12 }}
                  />
                  <Tooltip content={<DashboardTooltip />} cursor={{ fill: "rgba(110, 152, 114, 0.12)" }} />
                  <Bar dataKey="count" fill="#6e9872" radius={[6, 6, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Healthy vs Diseased */}
            <div className="dash-chart-card">
              <h4 className="dash-chart-title">Healthy vs Diseased</h4>
              <div className="dash-chart-body">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={dashboardMetrics.healthyVsDiseased} layout="vertical" margin={{ top: 24, right: 10, left: 8, bottom: 8 }} accessibilityLayer={false}>
                  <XAxis type="number" hide domain={[0, "dataMax"]} />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip content={<DashboardTooltip />} cursor={{ fill: "rgba(110, 152, 114, 0.12)" }} />
                  <Legend wrapperStyle={{ color: "#667168", fontSize: "12px" }} />
                  <Bar dataKey="healthy" name="Healthy" stackId="health" fill="#6e9872" radius={[6, 0, 0, 6]} />
                  <Bar dataKey="diseased" name="Diseased" stackId="health" fill="#b8514a" radius={[0, 6, 6, 0]} />
                </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Scans Table */}
            {recentPredictions.length > 0 && (
              <div className="dash-chart-card dash-table-card">
                <h4 className="dash-chart-title">Recent Scans</h4>
                <div className="dash-table-scroll">
                  <table className="dash-table">
                    <colgroup>
                      <col className="dash-col-select" />
                      <col className="dash-col-image" />
                      <col className="dash-col-timestamp" />
                      <col className="dash-col-plant" />
                      <col className="dash-col-disease" />
                      <col className="dash-col-confidence" />
                      <col className="dash-col-severity" />
                      <col className="dash-col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col"><input type="checkbox" checked={allDisplayedSelected} onChange={() => setSelectedScanIds((ids) => allDisplayedSelected ? ids.filter((id) => !displayedScanIds.includes(id)) : [...new Set([...ids, ...displayedScanIds])])} aria-label="Select displayed scans" /></th>
                        <th scope="col">Image</th>
                        <th scope="col">Timestamp</th>
                        <th scope="col">Plant</th>
                        <th scope="col">Disease</th>
                        <th scope="col">Confidence</th>
                        <th scope="col">Severity</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedScans.map((pred) => (
                      <tr
                        key={pred.id}
                        className="dash-scan-row"
                        onClick={() => setSelectedScan(pred)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedScan(pred);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`View details for ${pred.plant} ${pred.disease}`}
                      >
                        <td onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedScanIds.includes(pred.id)}
                            onChange={() => setSelectedScanIds((ids) => ids.includes(pred.id) ? ids.filter((id) => id !== pred.id) : [...ids, pred.id])}
                            aria-label={`Select ${pred.plant} ${pred.disease} scan`}
                          />
                        </td>
                        <td>
                          {pred.scan_image ? (
                            <img className="dash-scan-thumbnail" src={pred.scan_image} alt={`${pred.plant} ${pred.disease}`} />
                          ) : <span className="dash-no-image">—</span>}
                        </td>
                        <td className="dash-timestamp-cell">
                          {pred.timestamp
                            ? new Date(pred.timestamp).toLocaleString()
                            : "—"}
                        </td>
                        <td className="dash-plant-cell">
                          {pred.plant}
                        </td>
                        <td className="dash-disease-cell">
                          {pred.disease}
                          {pred.needs_review && <span className="dash-table-review">Review</span>}
                        </td>
                        <td>
                          <div className="dash-confidence-cell">
                            <span className="dash-conf-bar-track" aria-hidden="true">
                              <span
                                className="dash-conf-bar-fill"
                                style={{ width: `${pred.confidence}%` }}
                              />
                            </span>
                            <span className="dash-confidence-value">{pred.confidence}%</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`dash-severity-badge ${
                              pred.severity === "High"
                                ? "high"
                                : pred.severity === "Moderate"
                                ? "moderate"
                                : "none"
                            }`}
                          >
                            {pred.severity}
                          </span>
                        </td>
                        <td className="dash-actions-cell" onClick={(event) => event.stopPropagation()}>
                          <button
                            className="dash-dig-deep-btn"
                            onClick={() => setSelectedScan(pred)}
                          >
                            View Details
                          </button>
                          <button
                            className="dash-delete-btn"
                            onClick={(event) => handleDeleteScan(event, pred)}
                            aria-label={`Remove ${pred.plant} ${pred.disease} scan`}
                            title="Remove scan"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {recentPredictions.length > 5 && (
                  <button className="dash-show-more" onClick={() => setShowAllScans((current) => !current)}>
                    {showAllScans ? "Show fewer scans" : `Show all ${recentPredictions.length} scans`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Scan Details Modal ── */}
      <DeleteConfirmationDialog
        request={deleteRequest}
        pending={deletePending}
        error={deleteError}
        onCancel={() => {
          if (deletePending) return;
          setDeleteRequest(null);
          setDeleteError("");
        }}
        onConfirm={confirmDelete}
      />

      {selectedScan && (
        <div className="dig-deep-overlay" onClick={() => setSelectedScan(null)}>
          <div className="dig-deep-modal" onClick={(e) => e.stopPropagation()}>
            <header className="dig-deep-modal-header">
            <button
              className="dig-deep-close"
              onClick={() => setSelectedScan(null)}
              aria-label="Close scan details"
            >
              ✕
            </button>

            <h2 className="dig-deep-title">
              Analysis Result
              <span className="dig-deep-scan-label">
                {selectedScan.plant}
              </span>
              <span className="dig-deep-disease">{selectedScan.disease}</span>
            </h2>

            <div className="dig-deep-meta">
              <span className="dig-deep-timestamp">
                {selectedScan.timestamp
                  ? new Date(selectedScan.timestamp).toLocaleString()
                  : "—"}
              </span>
              <span
                className={`dash-severity-badge ${
                  selectedScan.severity === "High"
                    ? "high"
                    : selectedScan.severity === "Moderate"
                    ? "moderate"
                    : "none"
                }`}
              >
                {selectedScan.severity} Severity
              </span>
            </div>

            </header>

            <div className="dig-deep-modal-content">
            {selectedScan.needs_review && (
              <div className="dig-deep-warning">
                ⚠️ This prediction needs review — {!selectedScan.is_confident
                  ? "low confidence score"
                  : "multiple diseases have similar confidence"}
              </div>
            )}

            {selectedScan.scan_image && (
              <div className="dig-deep-image-section">
                <h4>Scan Image</h4>
                <img
                  src={selectedScan.scan_image}
                  alt={`${selectedScan.plant} scan`}
                  className="dig-deep-scan-image"
                />
              </div>
            )}

            {selectedScan.healthy_image && (
              <div className="dig-deep-image-section">
                <h4>Healthy Reference</h4>
                <img
                  src={selectedScan.healthy_image}
                  alt={`${selectedScan.plant} healthy reference`}
                  className="dig-deep-scan-image"
                />
              </div>
            )}

            {/* Confidence */}
            <div className="dig-deep-section">
              <h4>Confidence</h4>
              <div className="dig-deep-conf-row">
                <div className="dig-deep-conf-bar-track">
                  <div
                    className="dig-deep-conf-bar-fill"
                    style={{ width: `${selectedScan.confidence}%` }}
                  />
                </div>
                <span className="dig-deep-conf-value">
                  {selectedScan.confidence}%
                </span>
              </div>
              <div className="dig-deep-conf-spread">
                Confidence spread: <strong>{selectedScan.confidence_spread}%</strong>
              </div>
            </div>

            {/* Top Predictions */}
            {selectedScan.top_predictions?.length > 0 && (
              <div className="dig-deep-section">
                <h4>Top Predictions</h4>
                <div className="dig-deep-alternatives">
                  {selectedScan.top_predictions.map((tp, i) => (
                    <div key={i} className="dig-deep-alt-row">
                      <span className="dig-deep-alt-rank">#{i + 1}</span>
                      <span className="dig-deep-alt-name">
                        {tp.plant} — {tp.disease}
                      </span>
                      <span className="dig-deep-alt-conf">{tp.confidence}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expert Advice */}
            {selectedScan.advice && (
              <div className="dig-deep-section">
                <h4>Expert Advice</h4>
                <p className="dig-deep-advice">{selectedScan.advice}</p>
              </div>
            )}

            {/* Geography */}
            {selectedScan.geography && selectedScan.geography.climate && (
              <div className="dig-deep-section">
                <h4>Geography & Environment</h4>
                <div className="dig-deep-geo-grid">
                  <div className="dig-deep-geo-item">
                    <span className="dig-deep-geo-label">Climate</span>
                    <span className="dig-deep-geo-value">
                      {selectedScan.geography.climate}
                    </span>
                  </div>
                  <div className="dig-deep-geo-item">
                    <span className="dig-deep-geo-label">Temperature</span>
                    <span className="dig-deep-geo-value">
                      {selectedScan.geography.temperature_range || "—"}
                    </span>
                  </div>
                  <div className="dig-deep-geo-item">
                    <span className="dig-deep-geo-label">Soil</span>
                    <span className="dig-deep-geo-value">
                      {selectedScan.geography.soil || "—"}
                    </span>
                  </div>
                  <div className="dig-deep-geo-item">
                    <span className="dig-deep-geo-label">Regions</span>
                    <span className="dig-deep-geo-value">
                      {selectedScan.geography.typical_regions?.join(", ") || "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            </div>

            <footer className="dig-deep-modal-footer">
              <span className="dig-deep-footer-note">Scan details and recommended next steps</span>
              <div className="dig-deep-actions">
              <button
                className="dig-deep-primary-btn"
                onClick={() => setReportPrediction(selectedScan)}
              >
                Download Report (PDF)
              </button>
              <button
                className="dig-deep-secondary-btn"
                onClick={() => {
                  setSelectedScan(null);
                  setShowModelPerformance(true);
                }}
              >
                View Model Performance
              </button>
              </div>
            </footer>
          </div>
        </div>
      )}
      {reportPrediction && (
        <ReportPreview
          prediction={reportPrediction}
          modelAccuracy={data?.accuracy}
          onClose={() => setReportPrediction(null)}
        />
      )}

      {showModelPerformance && (
        <ModelPerformanceModal onClose={() => setShowModelPerformance(false)} />
      )}
    </div>
  );
}

export default Dashboard;
