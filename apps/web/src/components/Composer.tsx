"use client";

import { useState } from "react";
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
  const disabled = busy || closed;
  const canSend = !disabled && input.trim().length > 0;

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
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={closed ? "The case is closed." : placeholder}
          disabled={disabled}
          aria-label="What do you say or do?"
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
