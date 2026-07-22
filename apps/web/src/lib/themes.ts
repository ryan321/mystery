/**
 * Visual atmosphere themes for the play screen + mystery detail page.
 * Case definitions pick one via `meta.theme`; anything absent or unknown
 * falls back to the manor (the brand backdrop every other page uses).
 */
export const THEME_IDS = [
  "manor",
  "station",
  "noir",
  "snowfall",
  "daylight",
] as const;

export type AtmosphereTheme = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: AtmosphereTheme = "manor";

/** Validates a wire string — defaults survive schema drift and stale caches. */
export function asTheme(value: string | undefined): AtmosphereTheme {
  return (THEME_IDS as readonly string[]).includes(value ?? "")
    ? (value as AtmosphereTheme)
    : DEFAULT_THEME;
}

// ── User-selectable UI theme (the ◐ menu) ────────────────────────────

/** "auto" = follow the page (cases pick their theme); else forced. */
export type ThemeSelection = "auto" | AtmosphereTheme;

const THEME_KEY = "mystery.ui.theme";

export function loadThemeSelection(): ThemeSelection {
  if (typeof window === "undefined") return "auto";
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "auto") return "auto";
    if ((THEME_IDS as readonly string[]).includes(v ?? "")) {
      return v as AtmosphereTheme;
    }
  } catch {
    /* ignore */
  }
  return "auto";
}

export function saveThemeSelection(sel: ThemeSelection): void {
  try {
    localStorage.setItem(THEME_KEY, sel);
  } catch {
    /* ignore */
  }
}
