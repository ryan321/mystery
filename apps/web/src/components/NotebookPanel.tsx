import type { NotebookEntry } from "../lib/types";
import styles from "./NotebookPanel.module.css";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function NotebookPanel({
  entries,
}: {
  entries: NotebookEntry[];
}) {
  if (entries.length === 0) {
    return <p className={styles.empty}>The notebook is empty.</p>;
  }

  return (
    <ol className={styles.list}>
      {entries.map((entry) => (
        <li key={entry.id} className={styles.entry}>
          <div className={styles.meta}>
            <span
              className={`${styles.source} ${
                entry.source === "player" ? styles.player : styles.auto
              }`}
              title={entry.source === "player" ? "Your note" : "Recorded automatically"}
            >
              {entry.source === "player" ? "✎" : "✦"}
            </span>
            <span className={styles.time}>
              {formatTimestamp(entry.createdAt)}
            </span>
          </div>
          <p className={styles.text}>{entry.text}</p>
        </li>
      ))}
    </ol>
  );
}
