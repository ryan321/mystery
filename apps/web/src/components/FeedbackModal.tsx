"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./FeedbackModal.module.css";

const MAX_LEN = 2000;

/**
 * Free-text player feedback from the gameplay screen. Text state lives here
 * so a failed submit (parent passes the error back via `error`) doesn't lose
 * the message; `sent` shows a brief thanks before the parent closes us.
 */
export default function FeedbackModal({
  open,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  /** Resolves true when the feedback was accepted. */
  onSubmit: (text: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fresh message each time the modal opens; focus lands on the textarea.
  useEffect(() => {
    if (open) {
      setText("");
      setSent(false);
      textareaRef.current?.focus();
    }
  }, [open]);

  // Escape closes (unless a submit is in flight); backdrop click does too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (await onSubmit(trimmed)) {
      setSent(true);
      window.setTimeout(onClose, 1500);
    }
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className={styles.card}>
        <div className={styles.ribbon} aria-hidden="true" />
        <h2 id="feedback-title" className={styles.title}>
          Send feedback
        </h2>
        {sent ? (
          <p className={styles.sent}>Thanks — feedback sent.</p>
        ) : (
          <>
            <p className={styles.message}>
              What&apos;s working well, what&apos;s confusing, or what&apos;s
              broken?
            </p>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_LEN}
              rows={6}
              disabled={busy}
              placeholder="Tell us what's good, bad, or not working right…"
            />
            <div className={styles.counter}>
              {text.length}/{MAX_LEN}
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.submit}
                onClick={handleSubmit}
                disabled={busy || !text.trim()}
              >
                {busy ? "Sending…" : "Submit"}
              </button>
              <button
                type="button"
                className={styles.cancel}
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
