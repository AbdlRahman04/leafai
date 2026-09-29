import { useNavigate } from "react-router-dom";
import background from "../assets/backgroundd.jpg";
import TeamHover from "../components/TeamHover";
import "./Home.css";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container" style={{ backgroundImage: `url(${background})` }}>
      <div className="home-overlay" />
      <div className="home-particles" aria-hidden="true">
        <div className="home-particle" /><div className="home-particle" /><div className="home-particle" />
      </div>
      <TeamHover />

      <header className="home-topbar">
        <div className="home-brand">
          <span className="home-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 120 120" fill="none">
              <path d="M92 18C57 21 28 39 25 69c-2 19 11 31 29 29 29-3 37-31 38-80Z" fill="currentColor" />
              <path d="M29 91c16-20 31-34 57-57M46 76l-2-18M59 63l-1-17M39 82l-15 1" stroke="#16451d" strokeOpacity=".72" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
          <span>LeafAI</span>
        </div>
      </header>

      <main className="home-content">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <h1 id="home-title" className="home-title">Help your plants <span className="home-title-accent">thrive.</span></h1>
            <p className="home-subtitle">Turn one leaf photo into a clear, practical health check. LeafAI uses computer vision to spot disease patterns early, so you can act with confidence.</p>
            <button className="home-cta-primary" onClick={() => navigate("/choose")}>Start a leaf scan <span className="home-cta-arrow">→</span></button>
            <div className="home-quick-facts" aria-label="System highlights">
              <span><strong>128×128</strong> image input</span><span><strong>AI vision</strong> feature detection</span><span><strong>Top results</strong> with confidence</span>
            </div>
          </div>

          <div className="home-scan-preview" aria-label="Leaf scan preview">
            <div className="home-preview-glow" /><div className="home-preview-orbit home-preview-orbit-one" /><div className="home-preview-orbit home-preview-orbit-two" />
            <div className="home-leaf-icon">
              <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
                <path d="M92 18C57 21 28 39 25 69c-2 19 11 31 29 29 29-3 37-31 38-80Z" fill="url(#leafGradient)" />
                <path d="M29 91c16-20 31-34 57-57M46 76l-2-18M59 63l-1-17M39 82l-15 1" stroke="#d9f7d7" strokeOpacity=".72" strokeWidth="3" strokeLinecap="round" />
                <defs><linearGradient id="leafGradient" x1="25" y1="93" x2="92" y2="18" gradientUnits="userSpaceOnUse"><stop stopColor="#4caf50" /><stop offset="1" stopColor="#c5e8a8" /></linearGradient></defs>
              </svg>
            </div>
            <div className="home-preview-label"><span className="home-preview-check">✓</span><div><strong>Ready to analyze</strong><small>Upload a clear leaf image</small></div></div>
          </div>
        </section>

        <section className="home-how-it-works" aria-labelledby="how-it-works-title">
          <div className="home-section-heading"><span className="home-section-kicker">Simple by design</span><h2 id="how-it-works-title">From leaf to insight in three steps</h2><p>No complicated setup. Just a photo, a few seconds, and a result you can understand.</p></div>
          <div className="home-steps">
            <article className="home-step"><span className="home-step-number">01</span><div className="home-step-icon">↗</div><h3>Capture a leaf</h3><p>Upload an image or use your camera. A well-lit, focused leaf gives the model the clearest view.</p></article>
            <article className="home-step"><span className="home-step-number">02</span><div className="home-step-icon">◌</div><h3>AI studies the pattern</h3><p>The vision model examines color, texture, edges, and other visual signals learned from plant disease examples.</p></article>
            <article className="home-step"><span className="home-step-number">03</span><div className="home-step-icon">✓</div><h3>Get a clear next step</h3><p>See the likely condition, confidence, severity, helpful advice, and alternative predictions.</p></article>
          </div>
        </section>

        <section className="home-architecture" aria-labelledby="architecture-title">
          <div className="home-architecture-copy"><span className="home-section-kicker">Under the leaf</span><h2 id="architecture-title">A layered eye for plant health</h2><p>LeafAI combines a proven visual feature extractor with a small task-specific classifier. That keeps the experience fast while recognizing meaningful patterns.</p><button className="home-text-link" onClick={() => navigate("/choose")}>Try it with your plant <span>→</span></button></div>
          <div className="home-layer-stack" aria-label="AI model layers">
            <div className="home-layer home-layer-input"><span>01</span><div><strong>Image preparation</strong><small>Resize and normalize pixels</small></div></div>
            <div className="home-layer home-layer-feature"><span>02</span><div><strong>MobileNetV2 feature blocks</strong><small>Convolutional layers learn shapes, textures, and spots</small></div></div>
            <div className="home-layer home-layer-pool"><span>03</span><div><strong>Global average pooling</strong><small>Condenses visual evidence into a useful summary</small></div></div>
            <div className="home-layer home-layer-output"><span>04</span><div><strong>Dense and softmax classifier</strong><small>Ranks likely conditions with confidence scores</small></div></div>
          </div>
        </section>

      </main>
    </div>
  );
}

export default Home;
