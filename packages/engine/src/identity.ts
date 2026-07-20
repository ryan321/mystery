import type { MysteryDefinition, PlaythroughState } from "@mystery/shared";

/**
 * Identity knowledge helpers (PLAYER_SURFACES.md §5.4).
 * The player's label for a character is itself knowledge: "Orderly" until a
 * name reveal, then "Marcus Reed". Narration, packs, and UI must use these —
 * never the definition's real name while it is unknown.
 */

/** What the player currently knows this character as. */
export function knownAsFor(
  def: MysteryDefinition,
  state: PlaythroughState,
  characterId: string
): string {
  const pk = state.playerKnowledge?.[characterId];
  if (pk) return pk.knownAs;
  const ch = def.characters.find((c) => c.id === characterId);
  if (!ch) return characterId;
  return (ch.nameKnownAtStart ?? true) ? ch.name : ch.introducedAs ?? ch.name;
}

/** Whether the player has learned this character's real name. */
export function characterNameKnown(
  def: MysteryDefinition,
  state: PlaythroughState,
  characterId: string
): boolean {
  const pk = state.playerKnowledge?.[characterId];
  if (pk) return pk.nameKnown;
  const ch = def.characters.find((c) => c.id === characterId);
  return ch?.nameKnownAtStart ?? true;
}

/**
 * Fog of war: the player knows this place exists.
 * Visited ∪ runtime known flag (seeded from knownAtStart ∪ start location,
 * extended by the reveal_location effect).
 */
export function isLocationKnown(
  state: PlaythroughState,
  locationId: string
): boolean {
  if (state.visitedLocationIds.includes(locationId)) return true;
  return state.locationState[locationId]?.known === true;
}

/**
 * Existence fog: the player knows this character is part of the story.
 * Seeded from knownAtStart; flipped by entrances, the reveal_character
 * effect, name reveals, or meeting them (co-presence).
 */
export function characterKnown(
  def: MysteryDefinition,
  state: PlaythroughState,
  characterId: string
): boolean {
  const pk = state.playerKnowledge?.[characterId];
  if (pk) return pk.known;
  const ch = def.characters.find((c) => c.id === characterId);
  return ch?.knownAtStart ?? true;
}

/**
 * Meeting someone reveals them: mark characters sharing the player's
 * location as known. Run once per turn before persisting.
 */
export function revealCoPresentCharacters(
  def: MysteryDefinition,
  state: PlaythroughState
): { state: PlaythroughState; revealedIds: string[] } {
  const revealedIds: string[] = [];
  let next = state;
  for (const [cid, cs] of Object.entries(state.characterState)) {
    if (!cs.available || cs.locationId !== state.locationId) continue;
    if (characterKnown(def, next, cid)) continue;
    const prev = next.playerKnowledge?.[cid] ?? {
      known: false,
      knownAs: knownAsFor(def, next, cid),
      nameKnown:
        def.characters.find((c) => c.id === cid)?.nameKnownAtStart ?? true,
    };
    next = {
      ...next,
      playerKnowledge: {
        ...next.playerKnowledge,
        [cid]: { ...prev, known: true },
      },
    };
    revealedIds.push(cid);
  }
  return { state: next, revealedIds };
}
