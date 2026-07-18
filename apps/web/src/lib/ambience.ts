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
