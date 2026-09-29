import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/shared.css";
import App from "./App";
import "./styles/redesign.css";
import "./styles/dashboard-polish.css";

document.title = "LeafAI | Plant health intelligence";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
