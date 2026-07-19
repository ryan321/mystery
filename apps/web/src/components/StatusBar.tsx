import type {
  EnvironmentState,
  MysteryProgress,
  TimeState,
} from "../lib/types";
import { formatClock, timeLabel, weatherLabel } from "../lib/format";
import styles from "./StatusBar.module.css";

export default function StatusBar({
  locationName,
  time,
  environment,
  clocks,
  turnCount,
  progress,
  showProgressMeter,
  progressCompact,
}: {
  locationName: string;
  time?: TimeState;
  environment?: EnvironmentState;
  clocks?: Record<string, number>;
  turnCount: number;
  progress?: MysteryProgress | null;
  /** Show bar + "about two-thirds through" */
  showProgressMeter?: boolean;
  /** Compact chip only (subtle mode) */
  progressCompact?: boolean;
}) {
  const clockEntries = Object.entries(clocks ?? {});
  const frac = Math.max(0, Math.min(1, progress?.fraction ?? 0));
  const through =
    progress?.throughLabel ?? progress?.depthLabel ?? "In progress";
  const compact = progress?.throughCompact ?? "";

  return (
    <div className={styles.bar}>
      <div className={styles.location}>
        <span className={styles.label}>Location</span>
        <span className={styles.locationName}>{locationName}</span>
      </div>

      {time ? (
        <div className={styles.item}>
          <span className={styles.label}>Time</span>
          <span className={styles.value}>{timeLabel(time)}</span>
        </div>
      ) : null}

      {environment ? (
        <div className={styles.item}>
          <span className={styles.label}>Weather</span>
          <span className={styles.value}>{weatherLabel(environment)}</span>
        </div>
      ) : null}

      {clockEntries.map(([id, turns]) => (
        <span key={id} className={styles.clockChip}>
          {formatClock(id, turns)}
        </span>
      ))}

      {showProgressMeter && progress ? (
        <div
          className={styles.progress}
          title="Rough how far you are through the investigation — not whether you have the right answer"
        >
          <span className={styles.label}>Through</span>
          <span className={styles.progressTrack} aria-hidden>
            <span
              className={styles.progressFill}
              style={{ width: `${Math.round(frac * 100)}%` }}
            />
          </span>
          <span className={styles.progressLabel}>{through}</span>
        </div>
      ) : null}

      {progressCompact && progress && !showProgressMeter ? (
        <span className={styles.progressChip} title={through}>
          {compact || through}
        </span>
      ) : null}

      <div className={`${styles.item} ${styles.turns}`}>
        <span className={styles.label}>Turns</span>
        <span className={styles.value}>{turnCount}</span>
      </div>
    </div>
  );
}
