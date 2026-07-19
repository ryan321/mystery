"use client";

import type { ProgressUiMode } from "../lib/progressPrefs";
import styles from "./PlayProgressSettings.module.css";

const OPTIONS: { id: ProgressUiMode; label: string; hint: string }[] = [
  { id: "off", label: "Off", hint: "No progress cues" },
  { id: "subtle", label: "Subtle", hint: "Toasts + ≈⅔ chip" },
  { id: "full", label: "Full", hint: "Bar + “about two-thirds through”" },
];

/**
 * Progress visibility for this playthrough only — not a global account setting.
 */
export default function PlayProgressSettings({
  mode,
  caseAllowsProgress,
  onChange,
}: {
  mode: ProgressUiMode;
  /** false when author set progressUi: off */
  caseAllowsProgress: boolean;
  onChange: (mode: ProgressUiMode) => void;
}) {
  if (!caseAllowsProgress) {
    return (
      <div className={styles.wrap}>
        <span className={styles.label}>Progress</span>
        <p className={styles.disabled}>
          This mystery keeps progress cues off.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Progress</span>
      <div className={styles.row} role="radiogroup" aria-label="Progress">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={mode === o.id}
            className={mode === o.id ? `${styles.btn} ${styles.btnOn}` : styles.btn}
            onClick={() => onChange(o.id)}
            title={o.hint}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
