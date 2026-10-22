import { Link, useNavigate } from "react-router-dom";
import background from "../assets/backgroundd.jpg";
import TeamHover from "../components/TeamHover";
import { PLANTS } from "../utils/constants";
import "./Home.css";
import "./HomeDetails.css";

const resultDetails = [
  ["Likely condition", "The plant and condition that best match the image within the model’s supported categories."],
  ["Confidence & alternatives", "How strongly the model favors a result, alongside other possible matches. A high score can still be wrong."],
  ["Severity & guidance", "The severity category associated with the predicted condition and suggested next steps. It does not measure damage across the whole plant."],
];

const modelLayers = [
  ["RGB input", "128 × 128 × 3", "Convert the leaf photo to RGB, resize with nearest-neighbor interpolation, and map pixel values to [−1, 1]."],
  ["MobileNetV2 backbone", "ImageNet weights", "A pretrained convolutional feature extractor processes visual patterns such as edges, texture, and leaf structure. Its original classification head is removed."],
  ["Global average pooling", "Spatial features → vector", "Average each feature map into a compact representation for the task-specific classifier."],
  ["Dense layer + dropout", "256 ReLU units · 40% dropout", "Combine the extracted features. Dropout regularizes training and is disabled during prediction."],
  ["Softmax output", "38 class scores", "Rank the supported plant–condition classes and return the three highest-scoring alternatives."],
];

const requestSteps = [
  ["The browser sends the photo", "React + Vite", "Upload or camera capture creates an image file. The frontend sends it as multipart form data to POST /predict on the Flask API."],
  ["The server prepares the input", "Flask + Pillow + NumPy", "The backend decodes the image, converts it to RGB, and applies the same 128 × 128 resize and MobileNetV2 preprocessing used for training."],
  ["The model ranks the classes", "TensorFlow / Keras", "Inference runs with training disabled. The classifier sorts the 38 output scores, selects the leading class, and retains the top three predictions."],
  ["The result becomes a report", "JSON response + saved history", "The server adds condition-based severity, care guidance, and available reference data. The interface displays the response and offers reports and scan-history tools."],
];

const questions = [
  ["Does LeafAI recognize every plant disease?", "No. It compares your photo with the plant and condition categories learned from PlantVillage. An unsupported plant, a different disease, or environmental stress can produce a misleading match."],
  ["What should I do with a low-confidence result?", "Try another clear photo with even lighting and a simple background. Review the alternative predictions and compare the result with what you see on the plant. If the issue persists, seek advice from a qualified agricultural specialist."],
  ["Can I analyze more than one leaf?", "The Upload page supports batches of separate leaf photos. It also includes an experimental Multi-leaf Analysis mode for several leaves in one photo. Leaf extraction and per-leaf classification in that mode remain unvalidated and can be confidently incorrect."],
  ["Can I keep or download my analysis?", "You can download a PDF report from an analysis result. Saved analyses can be revisited in Reports, while the Dashboard summarizes available scan history."],
  ["Is this a confirmed diagnosis?", "No. LeafAI is a senior design project for educational use and early screening. Photo conditions and differences from the training data affect results. Use the prediction as a starting point for inspection, and confirm consequential care decisions with a qualified specialist."],
];

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container" style={{ backgroundImage: `url(${background})` }}>
      <div className="home-overlay" />
      <div className="home-particles" aria-hidden="true">
        <div className="home-particle" /><div className="home-particle" /><div className="home-particle" />
      </div>

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
        <TeamHover />
      </header>

      <div className="home-content">
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

        <nav className="home-detail-nav" aria-label="Explore LeafAI">
          <a href="#model-architecture">Model architecture</a>
          <a href="#model-training">Training</a>
          <a href="#system-workflow">System workflow</a>
          <a href="#model-evaluation">Evaluation</a>
        </nav>

        <section className="home-how-it-works" aria-labelledby="how-it-works-title">
          <div className="home-section-heading"><span className="home-section-kicker">Simple by design</span><h2 id="how-it-works-title">From leaf to insight in three steps</h2><p>No complicated setup. Just a photo, a few seconds, and a result you can understand.</p></div>
          <div className="home-steps">
            <article className="home-step"><span className="home-step-number">01</span><div className="home-step-icon">↗</div><h3>Capture a leaf</h3><p>Upload an image or use your camera. A well-lit, focused leaf gives the model the clearest view.</p></article>
            <article className="home-step"><span className="home-step-number">02</span><div className="home-step-icon">◌</div><h3>AI studies the pattern</h3><p>The vision model examines color, texture, edges, and other visual signals learned from plant disease examples.</p></article>
            <article className="home-step"><span className="home-step-number">03</span><div className="home-step-icon">✓</div><h3>Get a clear next step</h3><p>See the likely condition, confidence, severity, helpful advice, and alternative predictions.</p></article>
          </div>
        </section>

        <section id="model-architecture" className="home-detail-section home-detail-split" aria-labelledby="architecture-title">
          <div className="home-detail-heading">
            <h2 id="architecture-title">Inside the leaf classifier</h2>
            <p>LeafAI uses transfer learning: an ImageNet-pretrained MobileNetV2 backbone followed by a classifier trained on PlantVillage leaf images.</p>
            <p className="home-detail-note">The model predicts a plant–condition category from the whole input image. A standard scan does not locate disease patches or measure the damaged area of a leaf.</p>
          </div>
          <ol className="home-model-layers" aria-label="Classifier layers in processing order">
            {modelLayers.map(([title, specification, description]) => (
              <li key={title}><h3>{title}</h3><code>{specification}</code><p>{description}</p></li>
            ))}
          </ol>
        </section>

        <section id="model-training" className="home-detail-section" aria-labelledby="training-title">
          <div className="home-detail-heading">
            <h2 id="training-title">Train the head. Then fine-tune the backbone.</h2>
            <p>The documented training configuration uses two stages, keeping the pretrained visual features fixed first, then adapting the final layers at a smaller learning rate.</p>
          </div>
          <div className="home-training-stages">
            <article>
              <h3>1. Learn the classification head</h3>
              <p>Freeze the MobileNetV2 backbone and train the new dense classifier for up to 10 epochs.</p>
              <dl><div><dt>Optimizer</dt><dd>Adam</dd></div><div><dt>Initial learning rate</dt><dd><code>1 × 10⁻³</code></dd></div><div><dt>Trainable layers</dt><dd>Classification head</dd></div></dl>
            </article>
            <article>
              <h3>2. Adapt the final feature layers</h3>
              <p>Unfreeze the last 30 backbone layers and train alongside the head for up to 5 more epochs.</p>
              <dl><div><dt>Optimizer</dt><dd>Adam</dd></div><div><dt>Initial learning rate</dt><dd><code>1 × 10⁻⁵</code></dd></div><div><dt>Loss function</dt><dd>Categorical cross-entropy</dd></div></dl>
            </article>
          </div>
          <details className="home-training-notes">
            <summary>Dataset split, augmentation, and checkpoint selection</summary>
            <dl className="home-training-settings">
              <div><dt>Data split</dt><dd>80% training / 20% validation, using a directory-based split with random seed 42.</dd></div>
              <div><dt>Batch size</dt><dd>16 images per batch.</dd></div>
              <div><dt>Training augmentation</dt><dd>Rotation up to 20°, width and height shifts of 15%, zoom of 15%, and horizontal flips. Validation images are resized and preprocessed without these random transforms.</dd></div>
              <div><dt>Training controls</dt><dd>Early stopping monitors validation loss with patience 4. A plateau reduces the learning rate by a factor of 0.3 with patience 2, so the actual epoch count can be lower than requested.</dd></div>
              <div><dt>Model selection</dt><dd>Save the best validation-accuracy checkpoint from each stage, compare both candidates, and package the stronger one with its evaluation report.</dd></div>
            </dl>
          </details>
        </section>

        <section id="system-workflow" className="home-detail-section home-detail-split" aria-labelledby="workflow-title">
          <div className="home-detail-heading"><h2 id="workflow-title">From browser upload to prediction</h2><p>The frontend handles capture and presentation. Image preparation, model inference, and result enrichment run on the backend.</p><p className="home-detail-note">The model runs on the server; scanning requires a connection to the backend API.</p></div>
          <ol className="home-request-steps">
            {requestSteps.map(([title, technology, description]) => <li key={title}><h3>{title}</h3><span>{technology}</span><p>{description}</p></li>)}
          </ol>
        </section>

        <section id="model-evaluation" className="home-detail-section" aria-labelledby="evaluation-title">
          <div className="home-detail-heading"><h2 id="evaluation-title">Know what the metrics measure</h2><p>The training report records validation performance for the selected checkpoint. Because validation data is used to select the model, these scores are not an independent test of field accuracy.</p></div>
          <dl className="home-result-details">
            <div><dt>Accuracy & loss</dt><dd>Overall classification accuracy and categorical cross-entropy on the validation split, plus learning curves from both training stages.</dd></div>
            <div><dt>Precision, recall & F1</dt><dd>Per-class metrics show where predictions succeed or fail. Macro averages give each class equal weight; weighted averages account for class sample counts.</dd></div>
            <div><dt>Confusion matrix</dt><dd>A class-by-class view of the correct labels and predicted labels, helping identify conditions the model confuses.</dd></div>
          </dl>
          <div className="home-integrity-note"><h3>A report tied to its model</h3><p>The backend checks the model file’s SHA-256 fingerprint against its packaged results report before loading. This checks that the report belongs to the model file; it does not establish diagnostic accuracy.</p><Link className="home-detail-link" to="/dashboard">Explore available model metrics <span aria-hidden="true">→</span></Link></div>
        </section>

        <section id="scan-results" className="home-detail-section" aria-labelledby="scan-results-title">
          <div className="home-detail-heading">
            <h2 id="scan-results-title">Understand what your leaf is telling you</h2>
            <p>A scan brings the likely condition, the model’s confidence, and practical guidance into one view.</p>
          </div>
          <dl className="home-result-details">
            {resultDetails.map(([title, description]) => (
              <div key={title}><dt>{title}</dt><dd>{description}</dd></div>
            ))}
          </dl>
          <p className="home-detail-note">Where available, results also include a healthy reference image and growing-region information to help you compare and understand the plant.</p>
        </section>

        <section id="supported-plants" className="home-detail-section home-detail-split" aria-labelledby="supported-plants-title">
          <div className="home-detail-heading">
            <h2 id="supported-plants-title">38 classes across {PLANTS.length} plant categories</h2>
            <p>The PlantVillage label set contains plant–condition combinations, including healthy classes where available. The conditions represented vary by plant.</p>
            <p className="home-detail-note">If your plant is outside this list, the model may still return a match. That match should not be treated as reliable.</p>
          </div>
          <ul className="home-plant-list" aria-label="Supported plant categories">
            {PLANTS.map((plant) => <li key={plant}>{plant}</li>)}
          </ul>
        </section>

        <section className="home-detail-section" aria-labelledby="explore-tools-title">
          <div className="home-detail-heading"><h2 id="explore-tools-title">Keep learning after the scan</h2><p>Use the rest of LeafAI to revisit results and put them in context.</p></div>
          <div className="home-tool-links">
            <Link to="/reports"><span><strong>Analysis reports</strong><small>Revisit saved analyses and their findings.</small></span><span aria-hidden="true">→</span></Link>
            <Link to="/dashboard"><span><strong>Analytics dashboard</strong><small>Explore available scan history and model metrics.</small></span><span aria-hidden="true">→</span></Link>
            <Link to="/chat"><span><strong>Plant assistant</strong><small>Ask follow-up questions about plant conditions and care.</small></span><span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section id="common-questions" className="home-detail-section home-detail-split" aria-labelledby="common-questions-title">
          <div className="home-detail-heading"><h2 id="common-questions-title">A few things to know before you scan</h2><p>Understand the model’s scope and how to use its results thoughtfully.</p></div>
          <div className="home-faq-list">
            {questions.map(([question, answer]) => (
              <details key={question}><summary>{question}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary><p>{answer}</p></details>
            ))}
          </div>
        </section>

        <footer className="home-detail-footer">
          <div><h2>Take a closer look at your plant.</h2><p>Start with one clear leaf photo.</p></div>
          <Link className="home-detail-cta" to="/choose">Start a leaf scan <span aria-hidden="true">→</span></Link>
          <p className="home-detail-disclaimer">LeafAI is an educational senior design project. Predictions support early screening and do not replace professional agricultural diagnosis.</p>
        </footer>
      </div>
    </div>
  );
}

export default Home;
