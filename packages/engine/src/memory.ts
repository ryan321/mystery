import type {
  PlaythroughState,
  TurnModelOutput,
} from "@mystery/shared";

/** Append dialogue to per-character memory after a turn. */
export function appendDialogueMemory(
  state: PlaythroughState,
  playerInput: string,
  modelOut: TurnModelOutput,
  nowIso: string = new Date().toISOString()
): PlaythroughState {
  if (!modelOut.dialogue?.length) return state;

  const characterMemory = { ...state.characterMemory };

  for (const line of modelOut.dialogue) {
    const prev = characterMemory[line.characterId] ?? {
      revealedBeatIds: [],
      summary: "",
      recentTurns: [],
    };
    const recentTurns = [
      ...prev.recentTurns,
      { role: "player" as const, text: playerInput, at: nowIso },
      {
        role: "character" as const,
        text: line.text,
        at: nowIso,
      },
    ].slice(-12);

    characterMemory[line.characterId] = {
      ...prev,
      recentTurns,
    };
  }

  return { ...state, characterMemory };
}
