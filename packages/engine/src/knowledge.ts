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

  // Conditions satisfied (or none required) → AI may use this beat.
  return true;
}

/**
 * Beats the AI may freely use as known facts for this character.
 * Public knowledge is always allowed.
 */
export function allowedKnowledgeForCharacter(
  def: MysteryDefinition,
  state: PlaythroughState,
  characterId: string
): { allowed: string[]; mustNotReveal: string[] } {
  const character = def.characters.find((c) => c.id === characterId);
  if (!character) return { allowed: [], mustNotReveal: [] };

  const allowed: string[] = [];
  if (character.knowledge.public) {
    allowed.push(character.knowledge.public);
  }

  const mustNotReveal: string[] = [];

  for (const beat of allBeats(character)) {
    if (beatIsReleased(beat, state, characterId)) {
      allowed.push(beat.content);
    } else {
      // Do not put full secret text in mustNotReveal if we can avoid it —
      // use a short id-based constraint for the model.
      mustNotReveal.push(
        `Do not reveal knowledge beat "${beat.id}" (${beat.content.slice(0, 80)}…)`
      );
    }
  }

  // Also block solution dump
  mustNotReveal.push(
    "Do not name the true killer or solution unless the player has already solved the case."
  );

  return { allowed, mustNotReveal };
}

/**
 * Whether a beat may be marked revealed this turn (conditions currently satisfied).
 */
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

  // Conditions must hold now (player earned it this turn via flags/evidence).
  if (!flagsMatch(state.flags, beat.requiresFlags)) return false;
  if (beat.requiresEvidenceIds?.length) {
    for (const id of beat.requiresEvidenceIds) {
      if (!state.evidenceIds.includes(id)) return false;
    }
  }
  // Unconditional private beats can always be revealed once talked to
  return true;
}
