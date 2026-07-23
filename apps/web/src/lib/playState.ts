export type PlayStatus = "being_played" | "completed";

export type PlayStateEntry = {
  playthroughId: string;
  caseId: string;
  status: PlayStatus;
  updatedAt: string;
};

const STORAGE_KEY = "mystery:playState";

function load(): Record<string, PlayStateEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(state: Record<string, PlayStateEntry>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function markBeingPlayed(caseId: string, playthroughId: string) {
  const state = load();
  state[caseId] = {
    playthroughId,
    caseId,
    status: "being_played",
    updatedAt: new Date().toISOString(),
  };
  save(state);
}

export function markCompleted(caseId: string, playthroughId: string) {
  const state = load();
  state[caseId] = {
    playthroughId,
    caseId,
    status: "completed",
    updatedAt: new Date().toISOString(),
  };
  save(state);
}

export function getPlayState(caseId: string): PlayStateEntry | undefined {
  return load()[caseId];
}

/** Drop local tracking for a mystery (does not delete server playthroughs). */
export function clearPlayState(caseId: string) {
  const state = load();
  delete state[caseId];
  save(state);
}

export function getAllPlayStates(): Record<string, PlayStateEntry> {
  return load();
}

// ── In-flight turn marker ───────────────────────────────────────────────
// A turn is committed server-side even if the player leaves the page, but the
// UI only fetches once on mount and doesn't poll. This marker lets the play
// page know a turn was in flight when it (re)mounts, so it can show the spinner
// and poll until the turn lands instead of silently showing stale state.

export type PendingTurn = {
  playthroughId: string;
  /** turnCount the server will reach once this turn commits. */
  expectedTurnCount: number;
  /** epoch ms; the marker self-expires so a failed turn can't spin forever. */
  at: number;
};

const PENDING_KEY = "mystery:pendingTurn";
/** A real turn resolves well within this; past it the marker is stale. */
export const PENDING_TURN_TTL_MS = 150_000;

function loadPending(): Record<string, PendingTurn> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePending(state: Record<string, PendingTurn>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_KEY, JSON.stringify(state));
}

export function markTurnPending(playthroughId: string, expectedTurnCount: number) {
  const state = loadPending();
  state[playthroughId] = {
    playthroughId,
    expectedTurnCount,
    at: Date.now(),
  };
  savePending(state);
}

export function clearTurnPending(playthroughId: string) {
  const state = loadPending();
  if (state[playthroughId]) {
    delete state[playthroughId];
    savePending(state);
  }
}

/** A non-stale in-flight turn for this playthrough, if any. */
export function getTurnPending(playthroughId: string): PendingTurn | undefined {
  const p = loadPending()[playthroughId];
  if (!p) return undefined;
  if (Date.now() - p.at > PENDING_TURN_TTL_MS) {
    clearTurnPending(playthroughId);
    return undefined;
  }
  return p;
}
