import type { AtmosphereTheme } from "./themes";

export type AmbiencePack = {
  id: string;
  name: string;
  description?: string;
  sounds?: {
    rain?: string;
    thunder?: string[];
  };
};

export const AMBIENCE_PACKS: AmbiencePack[] = [
  {
    id: "manor-storm",
    name: "Manor Storm",
    description: "Rain on the manor windows, distant thunder.",
    sounds: {
      rain: "/audio/rain.opus",
      thunder: [
        "/audio/thunder-1.mp3",
        "/audio/thunder-2.mp3",
        "/audio/thunder-3.mp3",
        "/audio/thunder-4.mp3",
      ],
    },
  },
];

export function getAmbiencePack(id: string): AmbiencePack | undefined {
  return AMBIENCE_PACKS.find((p) => p.id === id);
}

// ── Music ───────────────────────────────────────────────────────────

export type MusicTrack = {
  id: string;
  name: string;
  file: string;
};

/**
 * Background beds (normalized to −20 LUFS, Opus 96k — processed from the
 * author's raw downloads, see apps/web/public/audio/music/). One seamless
 * loop per track; no playlists — track changes yank attention mid-scene.
 */
export const MUSIC_TRACKS: MusicTrack[] = [
  { id: "candlelit-piano", name: "Candlelit Piano", file: "/audio/music/candlelit-piano.opus" },
  { id: "dark-streets", name: "Dark Streets", file: "/audio/music/dark-streets.opus" },
  { id: "deep-space", name: "Deep Space", file: "/audio/music/deep-space.opus" },
  { id: "whiteout", name: "Whiteout", file: "/audio/music/whiteout.opus" },
  { id: "quirky", name: "Junior Detective", file: "/audio/music/quirky.opus" },
  { id: "astronomy", name: "Astronomy", file: "/audio/music/astronomy.opus" },
  { id: "pyramid", name: "Pyramid", file: "/audio/music/pyramid.opus" },
  { id: "documentary", name: "The Documentary", file: "/audio/music/documentary.opus" },
  { id: "mystical-1", name: "Mystical I", file: "/audio/music/mystical-1.opus" },
  { id: "mystical-2", name: "Mystical II", file: "/audio/music/mystical-2.opus" },
  { id: "wizarding-hour", name: "Wizarding Hour", file: "/audio/music/wizarding-hour.opus" },
];

/** musicId === "auto" follows the scene's atmosphere theme. */
export const MUSIC_AUTO = "auto";

/** Default bed per atmosphere theme — the mood the case author picked. */
export const THEME_DEFAULT_MUSIC: Record<AtmosphereTheme, string> = {
  manor: "candlelit-piano",
  station: "deep-space",
  noir: "dark-streets",
  snowfall: "whiteout",
  daylight: "quirky",
};

export function getMusicTrack(id: string): MusicTrack | undefined {
  return MUSIC_TRACKS.find((t) => t.id === id);
}

/** The track to actually play: the user's pick, or the scene default. */
export function resolveMusicTrack(
  musicId: string,
  pageTheme: AtmosphereTheme | null
): MusicTrack | undefined {
  const id =
    musicId === MUSIC_AUTO
      ? THEME_DEFAULT_MUSIC[pageTheme ?? "manor"]
      : musicId;
  return getMusicTrack(id);
}

// ── Stored settings ─────────────────────────────────────────────────

export type AmbienceState = {
  packId: string;
  soundsEnabled: boolean;
  musicEnabled: boolean;
  musicId: string;
};

export const DEFAULT_AMBIENCE: AmbienceState = {
  packId: "manor-storm",
  soundsEnabled: true,
  musicEnabled: false,
  musicId: MUSIC_AUTO,
};

const STORAGE_KEY = "mystery:ambience";

/** Stored settings, validated — defaults survive schema drift and tampering. */
export function loadAmbience(): AmbienceState {
  if (typeof window === "undefined") return DEFAULT_AMBIENCE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AMBIENCE;
    const parsed = JSON.parse(raw) as Partial<AmbienceState>;
    return {
      packId:
        typeof parsed.packId === "string" && getAmbiencePack(parsed.packId)
          ? parsed.packId
          : DEFAULT_AMBIENCE.packId,
      soundsEnabled:
        typeof parsed.soundsEnabled === "boolean"
          ? parsed.soundsEnabled
          : DEFAULT_AMBIENCE.soundsEnabled,
      musicEnabled:
        typeof parsed.musicEnabled === "boolean"
          ? parsed.musicEnabled
          : DEFAULT_AMBIENCE.musicEnabled,
      musicId:
        typeof parsed.musicId === "string" &&
        (parsed.musicId === MUSIC_AUTO || getMusicTrack(parsed.musicId))
          ? parsed.musicId
          : DEFAULT_AMBIENCE.musicId,
    };
  } catch {
    return DEFAULT_AMBIENCE;
  }
}

export function saveAmbience(state: AmbienceState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode and friends — settings just don't persist.
  }
}
