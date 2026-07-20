import type { PresentCharacter } from "../lib/types";
import { playerAssetUrl } from "../lib/api";
import styles from "./PresenceStrip.module.css";

/**
 * Presence strip (PLAYER_SURFACES.md §5.4): who is physically in the room,
 * labeled with what the player currently knows them as ("Orderly" until a
 * name is learned). Clicking a face opens the cast profile.
 */
export default function PresenceStrip({
  present,
  caseId,
  onSelect,
}: {
  present: PresentCharacter[];
  caseId: string;
  onSelect?: (characterId: string) => void;
}) {
  if (present.length === 0) {
    return <p className={styles.empty}>No one else is here.</p>;
  }
  return (
    <ul className={styles.strip}>
      {present.map((c) => {
        const url = playerAssetUrl(caseId, c.portrait);
        return (
          <li key={c.id}>
            <button
              type="button"
              className={styles.chip}
              onClick={() => onSelect?.(c.id)}
              title={`View ${c.knownAs}`}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.portrait} src={url} alt="" />
              ) : (
                <span className={styles.monogram} aria-hidden>
                  {c.knownAs.slice(0, 1)}
                </span>
              )}
              <span className={styles.label}>{c.knownAs}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
