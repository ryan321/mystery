import { useEffect, useState } from "react";
import type { CastEntry } from "../lib/types";
import { playerAssetUrl } from "../lib/api";
import styles from "./CastList.module.css";

const ROLE_LABEL: Record<CastEntry["storyRole"], string> = {
  victim: "The victim",
  suspect: "Suspect",
  witness: "Witness",
  support: "Household",
};

/**
 * Dramatis personae (PLAYER_SURFACES.md §5.4): front matter only — portrait,
 * what you know them as, role line, and the authored outline once the name
 * is known. Profiles never accumulate discovered facts; no meters, ever.
 * Tap a card for the full portrait — faces carry the realism of the piece.
 */
export default function CastList({
  cast,
  caseId,
  presentIds,
  focusId,
}: {
  cast: CastEntry[];
  caseId: string;
  /** Characters currently in the room with the player. */
  presentIds?: ReadonlySet<string>;
  /** Profile to open directly (e.g. tapped from the presence strip). */
  focusId?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? null);

  useEffect(() => {
    setSelectedId(focusId ?? null);
  }, [focusId]);

  const selected = selectedId
    ? cast.find((c) => c.id === selectedId)
    : undefined;

  if (selected) {
    const url = playerAssetUrl(caseId, selected.portrait);
    const present = presentIds?.has(selected.id) ?? false;
    return (
      <div className={styles.detail}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => setSelectedId(null)}
        >
          ← All characters
        </button>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.detailPortrait} src={url} alt={selected.knownAs} />
        ) : (
          <span className={styles.detailMonogram} aria-hidden>
            {selected.knownAs.slice(0, 1)}
          </span>
        )}
        <div className={styles.detailBody}>
          <h3 className={styles.detailName}>{selected.knownAs}</h3>
          <div className={styles.detailMeta}>
            <span className={styles.role}>{ROLE_LABEL[selected.storyRole]}</span>
            {present ? <span className={styles.here}>in the room</span> : null}
          </div>
          {selected.bio ? (
            <p className={styles.detailBio}>{selected.bio}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {cast.map((c) => {
        const url = playerAssetUrl(caseId, c.portrait);
        const present = presentIds?.has(c.id) ?? false;
        return (
          <li key={c.id}>
            <button
              type="button"
              className={styles.card}
              onClick={() => setSelectedId(c.id)}
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
              <div className={styles.body}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{c.knownAs}</span>
                  {present ? (
                    <span className={styles.here}>in the room</span>
                  ) : null}
                </div>
                <span className={styles.role}>{ROLE_LABEL[c.storyRole]}</span>
                {c.bio ? <p className={styles.bio}>{c.bio}</p> : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
