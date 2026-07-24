"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Composer.module.css";

export default function Composer({
  busy = false,
  closed = false,
  placeholder = "Type what you say or do…",
  onSend,
  /** Formal accusation ceremony is open — freeform is the charge. */
  accuseActive = false,
  winHint,
}: {
  busy?: boolean;
  closed?: boolean;
  placeholder?: string;
  onSend: (text: string) => void;
  accuseActive?: boolean;
  /** Short reminder while ceremony is open (who / how / why). */
  winHint?: string;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const disabled = busy || closed;
  const canSend = !disabled && input.trim().length > 0;

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const submit = () => {
    const text = input.trim();
    if (!text || disabled) return;
    setInput("");
    onSend(text);
  };

  return (
    <form
      className={`${styles.composer} ${accuseActive ? styles.accuseMode : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {accuseActive && winHint ? (
        <p className={styles.accuseHint} role="status">
          {winHint}
        </p>
      ) : null}
      {accuseActive ? (
        <p className={styles.accuseBanner} role="status">
          Formal accusation — the household is listening. State your charge, or
          say you are not ready.
        </p>
      ) : null}
      <div className={styles.frame}>
        <textarea
          ref={textareaRef}
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={closed ? "The case is closed." : placeholder}
          disabled={disabled}
          aria-label={
            accuseActive
              ? "State your formal accusation"
              : "What do you say or do?"
          }
          maxLength={500}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="submit"
          className={styles.send}
          disabled={!canSend}
          aria-label="Send"
        >
          <span className={styles.seal} aria-hidden="true">
            ✦
          </span>
          {busy ? "…" : "Send"}
        </button>
      </div>
    </form>
  );
}
