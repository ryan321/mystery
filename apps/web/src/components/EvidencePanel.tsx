import styles from "./EvidencePanel.module.css";

export type EvidenceItem = {
  id: string;
  name: string;
  description?: string;
  condition?: string;
  tags?: string[];
  flags?: Record<string, string | number | boolean>;
  timesExamined?: number;
  timesUsed?: number;
};

export default function EvidencePanel({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) {
    return <p className={styles.empty}>No evidence gathered yet.</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const flagEntries = Object.entries(item.flags ?? {});
        return (
          <li key={item.id} className={styles.card}>
            <div className={styles.name}>{item.name}</div>
            {item.description ? (
              <p className={styles.description}>{item.description}</p>
            ) : null}
            {item.condition ? (
              <div className={styles.row}>
                <span className={styles.label}>Condition</span>
                <span className={styles.value}>{item.condition}</span>
              </div>
            ) : null}
            {item.tags && item.tags.length > 0 ? (
              <div className={styles.tags}>
                {item.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {flagEntries.length > 0 ? (
              <div className={styles.tags}>
                {flagEntries.map(([key, val]) => (
                  <span key={key} className={styles.flag}>
                    {key}: {String(val)}
                  </span>
                ))}
              </div>
            ) : null}
            <div className={styles.stats}>
              <span>examined ×{item.timesExamined ?? 0}</span>
              <span>used ×{item.timesUsed ?? 0}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
