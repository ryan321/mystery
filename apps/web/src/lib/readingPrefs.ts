export type GameTextSize = "small" | "normal" | "large" | "largest";

/** Multiplier applied to game-screen text (log, bubbles, composer). */
export const GAME_TEXT_SCALES: Record<GameTextSize, number> = {
  small: 0.9,
  normal: 1,
  large: 1.15,
  largest: 1.3,
};

const KEY = "mystery.reading.textSize";

/**
 * Device-wide game text size, set on the Settings page.
 * Read on the play screen and applied as a CSS variable multiplier.
 */
export function getGameTextSize(): GameTextSize {
  if (typeof window === "undefined") return "normal";
  try {
    const v = localStorage.getItem(KEY);
    if (v === "small" || v === "normal" || v === "large" || v === "largest") {
      return v;
    }
  } catch {
    /* ignore */
  }
  return "normal";
}

export function setGameTextSize(size: GameTextSize): void {
  try {
    localStorage.setItem(KEY, size);
  } catch {
    /* ignore */
  }
}
