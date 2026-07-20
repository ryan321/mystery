import type { SceneView } from "../lib/types";
import styles from "./ScenePanel.module.css";

/**
 * Scene panel (PLAYER_SURFACES.md §5.2): the room at a glance — description,
 * exits with open/locked state, visible objects. Straight rendering of the
 * engine's leak-filtered scene view; hidden inspectables never arrive here.
 */
export default function ScenePanel({ scene }: { scene: SceneView }) {
  return (
    <div className={styles.scene}>
      <p className={styles.description}>{scene.description}</p>

      {scene.exits.length > 0 ? (
        <div className={styles.group}>
          <h4 className={styles.groupTitle}>Exits</h4>
          <ul className={styles.list}>
            {scene.exits.map((e) => (
              <li key={e.toLocationId} className={styles.item}>
                <span
                  className={`${styles.exitMark} ${
                    e.open ? styles.exitOpen : styles.exitClosed
                  }`}
                  aria-hidden
                >
                  {e.open ? "◦" : "×"}
                </span>
                <span className={e.open ? "" : styles.dimmed}>
                  {e.destinationKnown ? e.label : "Door — never taken"}
                </span>
                {!e.open ? <span className={styles.tag}>locked</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {scene.objects.length > 0 ? (
        <div className={styles.group}>
          <h4 className={styles.groupTitle}>You notice</h4>
          <ul className={styles.list}>
            {scene.objects.map((o) => (
              <li key={o.id} className={styles.item}>
                <span>{o.name}</span>
                {o.locked ? <span className={styles.tag}>locked</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
