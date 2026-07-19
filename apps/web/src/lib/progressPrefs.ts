export type ProgressUiMode = "off" | "subtle" | "full";

const playKey = (playthroughId: string) =>
  `mystery.play.${playthroughId}.progressUi`;

/**
 * Per-playthrough progress UI setting.
 * Different mystery runs can have different choices on this device.
 */
export function getPlayProgressPref(
  playthroughId: string | null | undefined
): ProgressUiMode | null {
  if (!playthroughId || typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(playKey(playthroughId));
    if (v === "off" || v === "subtle" || v === "full") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function setPlayProgressPref(
  playthroughId: string,
  mode: ProgressUiMode
): void {
  try {
    localStorage.setItem(playKey(playthroughId), mode);
  } catch {
    /* ignore */
  }
}

/**
 * Effective mode for this gameplay:
 * - Author `caseMode: "off"` forces off (mystery disables progress UI).
 * - Else the playthrough setting wins (off / subtle / full for this run only).
 */
export function effectiveProgressMode(
  caseMode: ProgressUiMode | undefined | null,
  playthroughMode: ProgressUiMode | null
): ProgressUiMode {
  const caseM = caseMode ?? "off";
  if (caseM === "off") return "off";
  // playthroughMode is always set once loaded (defaults to case mode)
  return playthroughMode ?? caseM;
}

/** Default when starting a run with no stored override. */
export function defaultPlayProgressMode(
  caseMode: ProgressUiMode | undefined | null
): ProgressUiMode {
  if (!caseMode || caseMode === "off") return "off";
  return caseMode;
}
