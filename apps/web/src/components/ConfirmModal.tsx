"use client";

import { useEffect, useRef } from "react";
import styles from "./ConfirmModal.module.css";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  /** Tints the confirm button as a consequential/irreversible action. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Escape closes; focus lands on the confirm button when shown.
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onMouseDown={(e) => {
        // Backdrop click cancels; clicks inside the card don't bubble here.
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className={styles.card}>
        <div className={styles.ribbon} aria-hidden="true" />
        <h2 id="confirm-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button
            ref={confirmRef}
            type="button"
            className={`${styles.confirm} ${destructive ? styles.destructive : ""}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
          <button
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
