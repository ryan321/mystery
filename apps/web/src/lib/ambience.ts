export type AmbiencePack = {
  id: string;
  name: string;
  description?: string;
  sounds?: {
    rain?: string;
    thunder?: string[];
  };
  music?: string;
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
    // music: undefined — no music yet
  },
];

export function getAmbiencePack(id: string): AmbiencePack | undefined {
  return AMBIENCE_PACKS.find((p) => p.id === id);
}

export type AmbienceState = {
  packId: string;
  soundsEnabled: boolean;
  musicEnabled: boolean;
};

export const DEFAULT_AMBIENCE: AmbienceState = {
  packId: "manor-storm",
  soundsEnabled: true,
  musicEnabled: false,
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
