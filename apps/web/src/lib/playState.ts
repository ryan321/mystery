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
