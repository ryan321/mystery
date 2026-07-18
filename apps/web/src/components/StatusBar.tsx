import type {
  EnvironmentState,
  PlayerStatus,
  TimeState,
} from "../lib/types";
import {
  formatClock,
  threatColor,
  timeLabel,
  weatherLabel,
} from "../lib/format";
import styles from "./StatusBar.module.css";

export default function StatusBar({
  locationName,
  phaseId,
  time,
  environment,
  playerStatus,
  clocks,
  turnCount,
}: {
  locationName: string;
  phaseId?: string;
  time?: TimeState;
  environment?: EnvironmentState;
  playerStatus?: PlayerStatus;
  clocks?: Record<string, number>;
  turnCount: number;
}) {
  const threat = playerStatus?.threat ?? "none";
  const clockEntries = Object.entries(clocks ?? {});

  return (
    <div className={styles.bar}>
      <div className={styles.location}>
        <span className={styles.label}>Location</span>
        <span className={styles.locationName}>{locationName}</span>
      </div>

      {phaseId ? (
        <div className={styles.item}>
          <span className={styles.phaseChip}>{phaseId}</span>
        </div>
      ) : null}

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

      {environment?.ambient ? (
        <div className={styles.item}>
          <span className={styles.label}>Ambient</span>
          <span className={styles.value}>{environment.ambient}</span>
        </div>
      ) : null}

      {threat !== "none" ? (
        <div className={styles.item}>
          <span className={styles.label}>Threat</span>
          <span className={styles.value} style={{ color: threatColor(threat) }}>
            {threat}
          </span>
        </div>
      ) : null}

      {clockEntries.map(([id, turns]) => (
        <span key={id} className={styles.clockChip}>
          {formatClock(id, turns)}
        </span>
      ))}

      <div className={`${styles.item} ${styles.turns}`}>
        <span className={styles.label}>Turns</span>
        <span className={styles.value}>{turnCount}</span>
      </div>
    </div>
  );
}
