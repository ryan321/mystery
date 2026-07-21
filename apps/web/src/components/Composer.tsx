"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Composer.module.css";

export default function Composer({
  busy = false,
  closed = false,
  placeholder = "Type what you say or do…",
  onSend,
}: {
  busy?: boolean;
  closed?: boolean;
  placeholder?: string;
  onSend: (text: string) => void;
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
      className={styles.composer}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className={styles.frame}>
        <textarea
          ref={textareaRef}
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={closed ? "The case is closed." : placeholder}
          disabled={disabled}
          aria-label="What do you say or do?"
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
