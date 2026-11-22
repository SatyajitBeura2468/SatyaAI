import React, { useEffect, useId } from "react";
import { AlertTriangle, X } from "lucide-react";

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: ConfirmRequest | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [request, onCancel]);

  if (!request) return null;
  return (
    <div className="confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
        <div className="confirm-icon"><AlertTriangle size={19} /></div>
        <button className="icon-btn confirm-close" onClick={onCancel} aria-label="Cancel"><X size={16} /></button>
        <h2 id={titleId}>{request.title}</h2>
        <p id={messageId}>{request.message}</p>
        <div className="confirm-actions">
          <button className="ghost-btn" onClick={onCancel}>Cancel</button>
          <button className="danger-btn" autoFocus onClick={onConfirm}>{request.confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
