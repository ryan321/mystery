import Link from "next/link";
import type { Ending, Resolution } from "../lib/types";
import styles from "./EndingOverlay.module.css";

export default function EndingOverlay({
  status,
  ending,
  resolution,
}: {
  status: "solved" | "failed";
  ending?: Ending;
  resolution?: Resolution;
}) {
  const title =
    ending?.title ??
    resolution?.title ??
    (status === "solved" ? "Case Closed" : "Case Failed");
  const kind = ending?.kind ?? resolution?.kind;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={`${styles.card} ${status === "failed" ? styles.failed : ""}`}>
        <div className={styles.waxRibbon}>
          <span className={styles.waxSeal} aria-hidden="true">
            ✦
          </span>
        </div>
        <p className={styles.verdictLabel}>
          {status === "solved" ? "Verdict — Solved" : "Verdict — Failed"}
        </p>
        <h2 className={styles.title}>{title}</h2>
        {kind ? <p className={styles.kind}>{kind}</p> : null}
        {ending?.templateNotes ? (
          <p className={styles.notes}>{ending.templateNotes}</p>
        ) : null}
        <Link href="/play" className={styles.newCase}>
          Start a new case
        </Link>
      </div>
    </div>
  );
}
