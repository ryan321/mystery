import type { InventoryEntry } from "../lib/types";
import styles from "./InventoryPanel.module.css";

/**
 * Inventory (PLAYER_SURFACES.md §5.5): what you carry, rendered straight
 * from the engine's inventory view. Red herrings render identically to
 * critical evidence — no importance markers, ever.
 */
export default function InventoryPanel({
  inventory,
}: {
  inventory: InventoryEntry[];
}) {
  if (inventory.length === 0) {
    return <p className={styles.empty}>Your pockets are empty.</p>;
  }
  return (
    <ul className={styles.list}>
      {inventory.map((item) => (
        <li key={item.id} className={styles.card}>
          <div className={styles.nameRow}>
            <span className={styles.name}>{item.name}</span>
            {item.condition && item.condition !== "intact" ? (
              <span className={styles.condition}>{item.condition}</span>
            ) : null}
          </div>
          {item.description ? (
            <p className={styles.description}>{item.description}</p>
          ) : null}
          {item.tags.length > 0 ? (
            <div className={styles.tags}>
              {item.tags.map((t) => (
                <span key={t} className={styles.tag}>
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
