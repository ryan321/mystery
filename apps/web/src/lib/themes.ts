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
