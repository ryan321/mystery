import { willingnessClass, willingnessLabel } from "../lib/format";
import styles from "./CastPanel.module.css";

export type CastCharacter = {
  id: string;
  name: string;
  willingness: string;
  stance: string;
  pressure: number;
};

const PRESSURE_BARS = 5;

export default function CastPanel({
  characters,
}: {
  characters: CastCharacter[];
}) {
  if (characters.length === 0) {
    return <p className={styles.empty}>No one else is here.</p>;
  }

  return (
    <ul className={styles.list}>
      {characters.map((c) => {
        const filled = Math.max(
          0,
          Math.min(PRESSURE_BARS, Math.round((c.pressure / 100) * PRESSURE_BARS))
        );
        const wClass = willingnessClass(c.willingness);
        return (
          <li key={c.id} className={styles.character}>
            <span className={styles.avatar} aria-hidden="true">
              {c.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <div className={styles.info}>
              <div className={styles.topRow}>
                <span className={styles.name}>{c.name}</span>
                <span
                  className={`${styles.chip} ${
                    wClass ? (styles[wClass] ?? "") : ""
                  }`}
                >
                  {willingnessLabel(c.willingness)}
                </span>
                <span className={`${styles.chip} ${styles.stance}`}>
                  {c.stance}
                </span>
              </div>
              <div
                className={styles.pressure}
                title={`Pressure: ${c.pressure}`}
              >
                {Array.from({ length: PRESSURE_BARS }, (_, i) => (
                  <span
                    key={i}
                    className={`${styles.bar} ${
                      i < filled ? styles.barFilled : ""
                    }`}
                  />
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
