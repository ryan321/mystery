"use client";

import { useEffect, useState } from "react";
import type { ProgressPulse } from "../lib/types";
import styles from "./ProgressToast.module.css";

export default function ProgressToast({
  pulses,
  pulseKey,
}: {
  pulses: ProgressPulse[];
  /** Change when a new turn delivers pulses so we re-show */
  pulseKey: number;
}) {
  const [visible, setVisible] = useState<ProgressPulse[]>([]);

  useEffect(() => {
    if (!pulses.length) {
      setVisible([]);
      return;
    }
    setVisible(pulses);
    const t = window.setTimeout(() => setVisible([]), 4200);
    return () => window.clearTimeout(t);
  }, [pulseKey, pulses]);

  if (!visible.length) return null;

  return (
    <div className={styles.stack} aria-live="polite">
      {visible.map((p) => (
        <div key={p.id} className={styles.toast} data-kind={p.kind}>
          <span className={styles.mark} aria-hidden>
            ✦
          </span>
          <span className={styles.text}>{p.text}</span>
        </div>
      ))}
    </div>
  );
}
