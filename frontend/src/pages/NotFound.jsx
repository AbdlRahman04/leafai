import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="page-container not-found-page" aria-labelledby="not-found-title">
      <div className="ui-empty-state">
        <span className="ui-empty-mark" aria-hidden="true">⌁</span>
        <p className="section-eyebrow">LeafAI workspace</p>
        <h1 id="not-found-title" className="page-title">This page is out of reach.</h1>
        <p className="page-subtitle">The link may be outdated, or the page may have moved.</p>
        <Link className="result-btn-primary" to="/dashboard">Go to dashboard</Link>
      </div>
    </section>
  );
}
