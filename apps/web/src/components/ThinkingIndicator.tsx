import styles from "./ThinkingIndicator.module.css";

export default function ThinkingIndicator() {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.candle} aria-hidden="true">
        <div className={styles.glow} />
        <div className={styles.flame} />
        <div className={styles.wick} />
        <div className={styles.stick} />
      </div>
      <span>The house is thinking</span>
      <span className={styles.dots} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
