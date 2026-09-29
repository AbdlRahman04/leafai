import { useNavigate } from "react-router-dom";

/**
 * Reusable glass-styled back button.
 * @param {{ to: string, label?: string }} props
 */
export default function BackButton({ to, label = "Back" }) {
  const navigate = useNavigate();

  return (
    <button
      className="back-button"
      onClick={() => navigate(to)}
    >
      <span className="back-button-arrow">←</span>
      {label}
    </button>
  );
}
