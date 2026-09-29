import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchChatTopics, sendChatMessage } from "../services/chatService";
import "./Chat.css";

const STORAGE_KEY = "leafai-chat-history";
const PREDICTION_KEY = "leafai-last-prediction";
const MAX_MESSAGES = 50;
const FALLBACK_PLANTS = ["Apple", "Corn", "Grape", "Pepper", "Potato", "Tomato"];

function loadMessages() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.text === "string").slice(-MAX_MESSAGES) : [];
  } catch {
    return [];
  }
}

function loadPrediction() {
  try {
    const value = JSON.parse(localStorage.getItem(PREDICTION_KEY) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function richText(text) {
  return String(text || "").split("\n").map((line, lineIndex) => {
    if (line.trim() === "---") return <hr key={lineIndex} />;
    const isBullet = /^[?*-]\s/.test(line.trim());
    const content = (isBullet ? line.trim().replace(/^[?*-]\s/, "") : line).split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part
    );
    return isBullet ? <div className="chat-answer-bullet" key={lineIndex}>{content}</div> : <p key={lineIndex}>{content || "\u00a0"}</p>;
  });
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function Chat() {
  const [messages, setMessages] = useState(loadMessages);
  const [prediction] = useState(loadPrediction);
  const [topics, setTopics] = useState([]);
  const [topicError, setTopicError] = useState(false);
  const [topicQuery, setTopicQuery] = useState("");
  const [selectedPlant, setSelectedPlant] = useState("Tomato");
  const [input, setInput] = useState("");
  const [useScanHistory, setUseScanHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedQuestion, setFailedQuestion] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchChatTopics().then((plants) => {
      setTopics(plants);
      if (plants.length && !plants.some((plant) => plant.name.toLowerCase() === "tomato")) setSelectedPlant(plants[0].name);
    }).catch(() => setTopicError(true));
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES))); } catch { /* Storage can be unavailable. */ }
  }, [messages]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, isLoading]);

  const plants = useMemo(() => topics.length ? topics : FALLBACK_PLANTS.map((name) => ({ name, diseases: [] })), [topics]);
  const filteredPlants = plants.filter((plant) => plant.name.toLowerCase().includes(topicQuery.trim().toLowerCase()));
  const selectedTopic = plants.find((plant) => plant.name.toLowerCase() === selectedPlant.toLowerCase()) || plants[0];

  const send = useCallback(async (question, retry = false) => {
    const clean = String(question || "").trim();
    if (!clean || isLoading) return;
    const previous = messages;
    if (!retry) setMessages([...previous, { sender: "user", text: clean }]);
    setInput("");
    setError("");
    setFailedQuestion("");
    setIsLoading(true);
    try {
      const answer = await sendChatMessage(clean, { plant: selectedPlant, disease: prediction?.disease }, previous, useScanHistory);
      setMessages((current) => [...current, { sender: "bot", text: answer.answer, sources: answer.sources, source: answer.source, resolvedPlant: answer.resolvedPlant, plantResolution: answer.plantResolution, usedScanHistory: answer.usedScanHistory }].slice(-MAX_MESSAGES));
    } catch (requestError) {
      setError(requestError.message || "The assistant could not answer right now.");
      setFailedQuestion(clean);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [isLoading, messages, prediction, selectedPlant, useScanHistory]);

  const askAboutHistory = () => {
    setUseScanHistory(true);
    setInput("What patterns appear in my saved scans?");
    inputRef.current?.focus();
  };

  const clearConversation = () => {
    setMessages([]);
    setError("");
    setFailedQuestion("");
    setUseScanHistory(false);
  };

  const copyAnswer = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1500);
    } catch { /* Clipboard may be unavailable. */ }
  };

  return (
    <div className="chat-page">
      <div className="chat-layout">
        <aside className="chat-library" aria-label="Plant knowledge browser">
          <div className="chat-library-heading">
            <h2>Plant library</h2>
            <p>Explore what LeafAI knows</p>
          </div>
          <label className="chat-search-label" htmlFor="chat-topic-search">Find a plant</label>
          <input id="chat-topic-search" className="chat-topic-search" value={topicQuery} onChange={(event) => setTopicQuery(event.target.value)} placeholder="Search plants" />
          <div className="chat-topic-list" role="group" aria-label="Plants">
            {filteredPlants.map((plant) => (
              <button key={plant.name} type="button" className={`chat-topic${selectedTopic?.name === plant.name ? " is-selected" : ""}`} onClick={() => setSelectedPlant(plant.name)} aria-pressed={selectedTopic?.name === plant.name}>
                <span>{plant.name}</span><ArrowIcon />
              </button>
            ))}
            {!filteredPlants.length && <p className="chat-topic-empty">No matching plant in the library.</p>}
          </div>
          {topicError && <p className="chat-library-note">Showing common plants. The full library will appear when the server reconnects.</p>}
          {messages.length > 0 && <div className="chat-topic-detail">
            <div className="chat-topic-detail-top"><span>Explore {selectedTopic?.name}</span><span>{selectedTopic?.diseases.length || 0} conditions</span></div>
            <button type="button" className="chat-featured-question" onClick={() => send(`What growing conditions does ${selectedTopic?.name} need?`)} disabled={isLoading}>
              <span>Growing guide</span><strong>How do I care for {selectedTopic?.name}?</strong><ArrowIcon />
            </button>
            <div className="chat-disease-list">
              {(selectedTopic?.diseases || []).slice(0, 5).map((disease) => (
                <button type="button" key={disease} onClick={() => send(`What are the symptoms and treatment for ${disease} on ${selectedTopic.name}?`)} disabled={isLoading}>
                  <span>{disease}</span><ArrowIcon />
                </button>
              ))}
              {!selectedTopic?.diseases.length && <span className="chat-no-conditions">Ask about this plant’s care or describe a symptom below.</span>}
            </div>
          </div>}
          <div className="chat-history-link">
            <span className="chat-history-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" /></svg></span>
            <div><strong>Your scan history</strong><span>Look for patterns in saved scans</span></div>
            <button type="button" onClick={askAboutHistory} aria-label="Ask about saved scans"><ArrowIcon /></button>
          </div>
        </aside>

        <section className="chat-workspace" aria-label="Plant assistant conversation">
          <header className="chat-workspace-header">
            <div><h1>Plant assistant</h1><p>Guidance grounded in LeafAI plant knowledge</p></div>
            <button type="button" className="chat-clear" onClick={clearConversation} disabled={!messages.length} title="Clear conversation">New conversation</button>
          </header>

          <div className="chat-conversation" aria-live="polite">
            {messages.length === 0 && (
              <div className="chat-intro">
                <div className="chat-intro-copy">
                  <h2>What would you like to know about your plants?</h2>
                  <p>Choose a plant to explore symptoms, care, and next steps. You can also ask about patterns in saved scans.</p>
                </div>
                <div className="chat-topic-detail chat-intro-prompts">
                  <div className="chat-topic-detail-top"><span>Start with {selectedTopic?.name}</span><span>{selectedTopic?.diseases.length || 0} conditions</span></div>
                  <button type="button" className="chat-featured-question" onClick={() => send(`What growing conditions does ${selectedTopic?.name} need?`)} disabled={isLoading}>
                    <span>Growing guide</span><strong>How do I care for {selectedTopic?.name}?</strong><ArrowIcon />
                  </button>
                  <div className="chat-disease-list">
                    {(selectedTopic?.diseases || []).slice(0, 4).map((disease) => (
                      <button type="button" key={disease} onClick={() => send(`What are the symptoms and treatment for ${disease} on ${selectedTopic.name}?`)} disabled={isLoading}>
                        <span>{disease}</span><ArrowIcon />
                      </button>
                    ))}
                    {!selectedTopic?.diseases.length && <span className="chat-no-conditions">Ask about this plant’s care or describe a symptom below.</span>}
                  </div>
                </div>
                {prediction?.plant && <button type="button" className="chat-last-scan" onClick={() => { setUseScanHistory(true); setInput(`Explain my latest ${prediction.plant} scan`); inputRef.current?.focus(); }}>
                  <span>Recent scan</span><strong>{prediction.plant} · {prediction.disease || "Result available"}</strong><ArrowIcon />
                </button>}
              </div>
            )}

            {messages.map((message, index) => (
              <article key={index} className={`chat-message chat-message-${message.sender}`}>
                {message.sender === "bot" && <span className="chat-message-name">LeafAI assistant</span>}
                <div className="chat-message-body">{message.sender === "bot" ? richText(message.text) : message.text}</div>
                {message.sender === "bot" && <div className="chat-message-footer">
                  <span className="chat-answer-source">{message.source === "groq" ? "Groq answer · LeafAI evidence" : "LeafAI local guidance"}{message.resolvedPlant ? ` · ${message.plantResolution === "question" ? "Asked about" : "Topic"} ${message.resolvedPlant}` : ""}{message.usedScanHistory ? " · saved scans included" : ""}</span>
                  {Array.isArray(message.sources) && message.sources.length > 0 && <details className="chat-evidence"><summary>Sources · {message.sources.length}</summary><ul>{message.sources.map((source, sourceIndex) => <li key={`${source.id || source.label}-${sourceIndex}`}><strong>{source.label}</strong><span>{source.detail}</span></li>)}</ul></details>}
                  <button type="button" className="chat-copy" onClick={() => copyAnswer(message.text, index)}>{copiedIndex === index ? "Copied" : "Copy answer"}</button>
                </div>}
              </article>
            ))}
            {isLoading && <div className="chat-pending" role="status"><span className="chat-pending-mark" />Checking LeafAI data…</div>}
            {error && <div className="chat-error" role="alert"><span>{error}</span><button type="button" onClick={() => send(failedQuestion, true)}>Retry</button></div>}
            <div ref={endRef} />
          </div>

          <div className="chat-composer-area">
            <label className="chat-history-toggle"><input type="checkbox" checked={useScanHistory} onChange={(event) => setUseScanHistory(event.target.checked)} /><span>Use saved scan history</span></label>
            <div className="chat-composer"><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(input); } }} placeholder="Ask about a plant, symptom, or past scan…" maxLength={500} rows={2} aria-label="Ask the plant assistant" disabled={isLoading} /><button type="button" onClick={() => send(input)} disabled={!input.trim() || isLoading} aria-label="Send question"><ArrowIcon /></button></div>
            <p>LeafAI scans are educational early screens. Check important decisions with a local expert.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Chat;
