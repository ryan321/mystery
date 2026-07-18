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

function relationshipGatesMet(
  def: MysteryDefinition,
  state: PlaythroughState,
  beat: KnowledgeBeat
): boolean {
  const relIds = [
    ...(beat.requiresRelationshipIds ?? []),
    ...(beat.requiresRelationshipId ? [beat.requiresRelationshipId] : []),
  ];
  for (const rid of relIds) {
    const defEdge = def.relationships.find((r) => r.id === rid);
    if (!defEdge) return false;
    const rt = state.relationshipState[rid];
    const active = rt?.active ?? defEdge.startsActive;
    const known = rt?.knownToPlayer ?? defEdge.knownToPlayerByDefault;
    if (!active || !known) return false;
  }
  return true;
}

export function beatIsReleased(
  def: MysteryDefinition,
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
    const w = state.characterState[characterId]?.willingness ?? "open";
    if (!beat.requiresWillingnessIn.includes(w)) return false;
  }

  if (beat.requiresTrust != null) {
    const trust = state.characterState[characterId]?.trust ?? 0;
    if (trust < beat.requiresTrust) return false;
  }

  if (!relationshipGatesMet(def, state, beat)) return false;

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

  // Withheld beats are reported only as an opaque count — descriptive beat
  // ids ("saw-vale-earlier") would leak their content into the prompt.
  let withheldCount = 0;
  for (const beat of allBeats(character)) {
    if (beatIsReleased(def, beat, state, characterId)) {
      allowed.push(beat.content);
    } else {
      withheldCount += 1;
    }
  }
  if (withheldCount > 0) {
    mustNotReveal.push(
      `This character is holding back ${withheldCount} undisclosed fact${withheldCount === 1 ? "" : "s"}. Do not invent, hint at, or reveal what they might be.`
    );
  }

  const judged =
    state.status === "denouement" ||
    state.status === "solved" ||
    state.status === "failed" ||
    state.flags.case_solved === true ||
    state.flags.case_failed === true;

  if (!judged) {
    mustNotReveal.push(
      "Do not name the true killer or full solution unless case is already solved."
    );
  } else if (
    state.flags.case_solved === true ||
    state.resolution?.outcome === "success" ||
    state.resolution?.outcome === "partial"
  ) {
    if (def.solution.guiltyPartyIds.includes(characterId)) {
      allowed.push(
        `CONFESSION / AFTERMATH (case judged): You are guilty. Truth: ${def.solution.summary}`
      );
      if (def.solution.method) {
        allowed.push(`Method: ${def.solution.method}`);
      }
      if (def.solution.motive) {
        allowed.push(`Motive: ${def.solution.motive}`);
      }
    } else {
      allowed.push(
        "The case has been judged. React as someone who just learned the official conclusion — shock, relief, anger, denial — without inventing a different killer."
      );
    }
  } else {
    allowed.push(
      "The investigation failed or went wrong. React to consequences (escape, arrest of the detective, fear) without freely dumping the sealed solution unless your character would know it."
    );
  }

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
  if (beat.requiresTrust != null) {
    const trust = state.characterState[characterId]?.trust ?? 0;
    if (trust < beat.requiresTrust) return false;
  }
  if (!relationshipGatesMet(def, state, beat)) return false;
  return true;
}
