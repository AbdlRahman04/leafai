import { useEffect, useRef } from "react";
import "./DeleteConfirmationDialog.css";

function DeleteConfirmationDialog({ request, pending, error, onCancel, onConfirm }) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!request) return undefined;
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !pending) onCancel();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, pending, request]);

  if (!request) return null;

  return (
    <div className="delete-confirm-overlay" onMouseDown={!pending ? onCancel : undefined}>
      <section
        className="delete-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="delete-confirm-marker" aria-hidden="true">!</div>
        <div className="delete-confirm-content">
          <p className="delete-confirm-eyebrow">Permanent action</p>
          <h2 id="delete-confirm-title">{request.title}</h2>
          <p id="delete-confirm-description">{request.description}</p>
          {error && <p className="delete-confirm-error" role="alert">{error}</p>}
        </div>
        <div className="delete-confirm-actions">
          <button ref={cancelButtonRef} type="button" className="delete-confirm-cancel" onClick={onCancel} disabled={pending}>
            Keep it
          </button>
          <button type="button" className="delete-confirm-action" onClick={onConfirm} disabled={pending}>
            {pending ? "Removing..." : request.actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export default DeleteConfirmationDialog;
