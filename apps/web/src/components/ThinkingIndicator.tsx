"use client";

import { useEffect, useState } from "react";
import styles from "./ThinkingIndicator.module.css";

const PHRASES = [
  "Considering…",
  "The house listens…",
  "Following the thread…",
  "Reading the room…",
  "Weighing the words…",
];

export default function ThinkingIndicator() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={styles.wrap} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.card}>
        <div className={styles.orb} aria-hidden="true">
          <span className={styles.ring} />
          <span className={`${styles.ring} ${styles.ring2}`} />
          <span className={styles.core} />
          <span className={styles.spark} />
          <span className={`${styles.spark} ${styles.spark2}`} />
          <span className={`${styles.spark} ${styles.spark3}`} />
        </div>
        <div className={styles.copy}>
          <span className={styles.label} key={phraseIndex}>
            {PHRASES[phraseIndex]}
          </span>
          <span className={styles.sub}>Waiting on the story</span>
        </div>
        <div className={styles.bar} aria-hidden="true">
          <span className={styles.barFill} />
        </div>
      </div>
    </div>
  );
}
