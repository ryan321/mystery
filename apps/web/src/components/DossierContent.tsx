import type { OpeningPackage, PlayerView } from "../lib/types";
import styles from "./DossierContent.module.css";

const FORM_LABEL: Record<OpeningPackage["form"], string> = {
  dossier: "Case dossier",
  letter: "Letter",
  telegram: "Telegram",
  invitation: "Invitation",
  memory: "What you already know",
  custom: "Opening notes",
};

/**
 * Opening package (PLAYER_SURFACES.md §5.1): the starting information this
 * protagonist would have, in the diegetic form the premise calls for.
 * Shown automatically at case start; reopenable any time.
 */
export default function DossierContent({
  openingPackage,
  player,
}: {
  openingPackage: OpeningPackage;
  player?: PlayerView["player"];
}) {
  return (
    <div className={styles.dossier}>
      <span className={styles.form}>{FORM_LABEL[openingPackage.form]}</span>
      {openingPackage.title ? (
        <h3 className={styles.title}>{openingPackage.title}</h3>
      ) : null}
      {player ? (
        <p className={styles.who}>
          You are <strong>{player.displayName}</strong>, {player.role}.
        </p>
      ) : null}
      {openingPackage.sections.map((s, i) => (
        <section key={i} className={styles.section}>
          <h4 className={styles.heading}>{s.heading}</h4>
          <p className={styles.text}>{s.text}</p>
        </section>
      ))}
    </div>
  );
}
