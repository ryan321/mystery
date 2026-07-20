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
