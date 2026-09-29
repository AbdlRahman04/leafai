import { useState } from "react";
import { predictDisease } from "../services/predictService";

/**
 * Custom hook that encapsulates the shared prediction workflow.
 * Used by both Upload and Camera pages.
 */
export function usePrediction() {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitImage = async (file, runKey) => {
    if (!file) return;

    try {
      setLoading(true);
      setError("");
      const result = await predictDisease(file, runKey);
      setPrediction(result);
      return result;
    } catch (error) {
      const status = error?.response?.status;
      const backendMessage = error?.response?.data?.error;
      const timedOut = error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT";
      const message = timedOut
        ? "The server took longer than 90 seconds. Please try a smaller image or try again later."
        : backendMessage || error?.message || "Unknown error";

      console.error("Prediction error:", { status, message, error });
      setError(`Prediction failed${status ? ` (HTTP ${status})` : ""}: ${message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPrediction(null);
    setError("");
  };

  return { prediction, loading, error, submitImage, reset };
}
