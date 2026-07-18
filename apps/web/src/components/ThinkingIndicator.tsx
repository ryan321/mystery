import styles from "./ThinkingIndicator.module.css";

export default function ThinkingIndicator() {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.watch} aria-hidden="true">
        <div className={styles.crown} />
        <div className={styles.case} />
        <div className={`${styles.hand} ${styles.hour}`} />
        <div className={`${styles.hand} ${styles.minute}`} />
      </div>
      <span>Turning the page</span>
      <span className={styles.dots} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
