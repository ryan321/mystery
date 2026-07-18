import type { Denouement, Ending, Resolution } from "../lib/types";
import styles from "./DenouementBanner.module.css";

export default function DenouementBanner({
  ending,
  resolution,
  denouement,
}: {
  ending?: Ending;
  resolution?: Resolution;
  denouement?: Denouement;
}) {
  const title = ending?.title ?? resolution?.title ?? "Aftermath";

  return (
    <div className={styles.banner}>
      <div className={styles.topRow}>
        <span className={styles.title}>{title}</span>
        <span className={styles.meta}>
          wrap-up
          {denouement?.turnsRemaining != null
            ? ` · ${denouement.turnsRemaining} turn${
                denouement.turnsRemaining === 1 ? "" : "s"
              } left`
            : ""}
          {" · still interactive"}
        </span>
      </div>
      <div className={styles.hint}>
        Talk to people, witness the fallout, or type &lsquo;I leave&rsquo; to
        end.
      </div>
    </div>
  );
}
