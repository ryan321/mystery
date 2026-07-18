import type {
  Character,
  KnowledgeBeat,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import { flagsMatch } from "./flags.js";

export function allBeats(character: Character): KnowledgeBeat[] {
  return [...character.knowledge.private, ...character.knowledge.secrets];
}

export function beatIsReleased(
  beat: KnowledgeBeat,
  state: PlaythroughState,
  characterId: string
): boolean {
  const memory = state.characterMemory[characterId];
  if (memory?.revealedBeatIds.includes(beat.id)) return true;

  if (!flagsMatch(state.flags, beat.requiresFlags)) return false;

  if (beat.requiresEvidenceIds?.length) {
    for (const id of beat.requiresEvidenceIds) {
      if (!state.evidenceIds.includes(id)) return false;
    }
  }

  if (beat.requiresWillingnessIn?.length) {
    const w =
      state.characterState[characterId]?.willingness ?? "open";
    if (!beat.requiresWillingnessIn.includes(w)) return false;
  }

  // Silent characters share almost nothing beyond public unless already revealed
  const willingness =
    state.characterState[characterId]?.willingness ?? "open";
  if (willingness === "silent" || willingness === "fled") {
    return false;
  }

  return true;
}

/**
 * Beats the AI may freely use as known facts for this character.
 * Public knowledge is always allowed unless silent/fled.
 */
export function allowedKnowledgeForCharacter(
  def: MysteryDefinition,
  state: PlaythroughState,
  characterId: string
): { allowed: string[]; mustNotReveal: string[] } {
  const character = def.characters.find((c) => c.id === characterId);
  if (!character) return { allowed: [], mustNotReveal: [] };

  const willingness =
    state.characterState[characterId]?.willingness ?? "open";
  const allowed: string[] = [];
  const mustNotReveal: string[] = [];

  if (willingness !== "silent" && willingness !== "fled") {
    if (character.knowledge.public) {
      allowed.push(character.knowledge.public);
    }
  } else {
    mustNotReveal.push("Character is unwilling to share useful information.");
  }

  for (const beat of allBeats(character)) {
    if (beatIsReleased(beat, state, characterId)) {
      allowed.push(beat.content);
    } else {
      mustNotReveal.push(`Withheld knowledge id: ${beat.id}`);
    }
  }

  mustNotReveal.push(
    "Do not name the true killer or full solution unless case is already solved."
  );

  return { allowed, mustNotReveal };
}

export function canRevealBeat(
  def: MysteryDefinition,
  state: PlaythroughState,
  characterId: string,
  beatId: string
): boolean {
  const character = def.characters.find((c) => c.id === characterId);
  if (!character) return false;
  const beat = allBeats(character).find((b) => b.id === beatId);
  if (!beat) return false;

  if (!flagsMatch(state.flags, beat.requiresFlags)) return false;
  if (beat.requiresEvidenceIds?.length) {
    for (const id of beat.requiresEvidenceIds) {
      if (!state.evidenceIds.includes(id)) return false;
    }
  }
  return true;
}
