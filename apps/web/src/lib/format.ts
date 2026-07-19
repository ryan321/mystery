import type { CaseSummary, EnvironmentState, TimeState } from "./types";

export function difficultyLabel(difficulty?: CaseSummary["meta"]["difficulty"]): string {
  if (difficulty === "hard") return "Difficult";
  if (difficulty === "medium") return "Medium";
  return "Easy";
}

/** Difficulty lives on meta.difficulty — never as a theme tag chip. */
const DIFFICULTY_TAG_RE = /^(easy|medium|hard|difficult)$/i;

export function themeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  return tags.filter((t) => !DIFFICULTY_TAG_RE.test(t.trim()));
}

export function difficultyClass(
  difficulty?: CaseSummary["meta"]["difficulty"]
): string {
  if (difficulty === "hard") return "difficulty-hard";
  if (difficulty === "medium") return "difficulty-medium";
  return "difficulty-easy";
}

export function timeLabel(time?: TimeState): string {
  if (!time) return "";
  return time.slotId
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function weatherLabel(env?: EnvironmentState): string {
  if (!env) return "";
  const w = env.weather;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

export function threatColor(threat?: string): string {
  switch (threat) {
    case "watched":
      return "#d4b56a";
    case "threatened":
      return "#e08a8a";
    case "assaulted":
      return "#ff6a5a";
    default:
      return "#9aafc4";
  }
}

export function conditionColor(condition?: string): string {
  switch (condition) {
    case "shaken":
      return "#d4b56a";
    case "bruised":
      return "#e08a8a";
    case "injured":
      return "#ff6a5a";
    case "incapacitated":
      return "#ff3d2e";
    default:
      return "#9aafc4";
  }
}

export function controlColor(control?: string): string {
  switch (control) {
    case "held":
      return "#d4b56a";
    case "downed":
      return "#e08a8a";
    case "restrained":
      return "#ff6a5a";
    case "unconscious":
      return "#ff3d2e";
    default:
      return "#9aafc4";
  }
}

export function willingnessLabel(w: string): string {
  switch (w) {
    case "open":
      return "Open";
    case "guarded":
      return "Guarded";
    case "hostile":
      return "Hostile";
    case "silent":
      return "Silent";
    case "fled":
      return "Fled";
    default:
      return w;
  }
}

export function willingnessClass(w: string): string {
  switch (w) {
    case "open":
      return "willing-open";
    case "guarded":
      return "willing-guarded";
    case "hostile":
      return "willing-hostile";
    case "silent":
      return "willing-silent";
    case "fled":
      return "willing-fled";
    default:
      return "";
  }
}

export function formatClock(clockId: string, turns: number): string {
  const name = clockId
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${name}: ${turns} turn${turns === 1 ? "" : "s"}`;
}
