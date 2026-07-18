import styles from "./MapPanel.module.css";

export default function MapPanel({
  visitedLocationIds,
  currentLocationId,
  locationNames,
}: {
  visitedLocationIds: string[];
  currentLocationId: string;
  locationNames?: Record<string, string>;
}) {
  if (visitedLocationIds.length === 0) {
    return <p className={styles.empty}>Nowhere explored yet.</p>;
  }

  const nameFor = (id: string) => locationNames?.[id] ?? id;

  return (
    <ul className={styles.list}>
      {visitedLocationIds.map((id) => {
        const current = id === currentLocationId;
        return (
          <li
            key={id}
            className={`${styles.location} ${current ? styles.current : ""}`}
            aria-current={current ? "location" : undefined}
          >
            <span className={styles.marker} aria-hidden="true">
              {current ? "◈" : "◇"}
            </span>
            <span className={styles.name}>{nameFor(id)}</span>
            {current ? <span className={styles.here}>here</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
