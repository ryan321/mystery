"use client";

import { useEffect, useState } from "react";
import {
  getGameTextSize,
  setGameTextSize,
  type GameTextSize,
} from "../../lib/readingPrefs";
import styles from "./page.module.css";

const OPTIONS: { id: GameTextSize; label: string; desc: string }[] = [
  { id: "small", label: "Small", desc: "Denser log, more of the scene on screen" },
  { id: "normal", label: "Normal", desc: "The default reading size" },
  { id: "large", label: "Large", desc: "Easier on the eyes" },
  { id: "largest", label: "Largest", desc: "Maximum readability" },
];

/**
 * Game text size — stored on this device, applied to the play screen
 * (log, dialogue, and the composer) the next time it renders.
 */
export default function GameTextSizeSettings() {
  // "normal" on the server/first paint; stored choice lands on mount.
  const [size, setSize] = useState<GameTextSize>("normal");
  useEffect(() => setSize(getGameTextSize()), []);

  return (
    <div className={styles.options} role="radiogroup" aria-label="Game text size">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={size === o.id}
          className={`${styles.option} ${size === o.id ? styles.optionOn : ""}`}
          onClick={() => {
            setGameTextSize(o.id);
            setSize(o.id);
          }}
        >
          <span className={styles.optionLabel}>{o.label}</span>
          <span className={styles.optionDesc}>{o.desc}</span>
        </button>
      ))}
    </div>
  );
}
