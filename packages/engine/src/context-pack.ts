import type { MysteryDefinition, PlaythroughState } from "@mystery/shared";
import { flagsMatch } from "./flags.js";
import { allowedKnowledgeForCharacter } from "./knowledge.js";

/**
 * Projection of definition + state safe to send to the narrator model.
 * Must never include solution.summary or unreleased secret full graphs wholesale
 * beyond mustNotReveal constraints.
 */
export function buildContextPack(
  def: MysteryDefinition,
  state: PlaythroughState,
  options?: { focusCharacterId?: string }
) {
  const location = def.locations.find((l) => l.id === state.locationId);
  if (!location) {
    throw new Error(`Unknown location ${state.locationId}`);
  }

  const visibleInspectables = location.inspectables
    .filter((i) => flagsMatch(state.flags, i.hiddenUntilFlags))
    .map((i) => ({
      id: i.id,
      name: i.name,
      narrativeHints: i.onInspect.narrativeHints,
      alreadyCollectedEvidenceIds: (i.onInspect.revealsEvidenceIds ?? []).filter(
        (id) => state.evidenceIds.includes(id)
      ),
    }));

  const exits = location.exits
    .filter((e) => flagsMatch(state.flags, e.requiresFlags))
    .map((e) => {
      const dest = def.locations.find((l) => l.id === e.toLocationId);
      return {
        toLocationId: e.toLocationId,
        label: e.label ?? dest?.name ?? e.toLocationId,
      };
    });

  const presentCharacters = location.charactersPresent
    .filter((p) => flagsMatch(state.flags, p.requiresFlags))
    .map((p) => {
      const c = def.characters.find((ch) => ch.id === p.characterId);
      return c
        ? { id: c.id, name: c.name, shortBio: c.shortBio ?? "" }
        : null;
    })
    .filter(Boolean);

  const evidenceHeld = state.evidenceIds
    .map((id) => def.evidence.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => ({
      id: e!.id,
      name: e!.name,
      description: e!.description,
    }));

  const flagsPublic: Record<string, unknown> = {};
  for (const f of def.flags) {
    if (f.aiVisible && state.flags[f.id] !== undefined) {
      flagsPublic[f.id] = state.flags[f.id];
    }
  }

  let activeCharacter: ReturnType<typeof characterSlice> | undefined;
  if (options?.focusCharacterId) {
    activeCharacter = characterSlice(def, state, options.focusCharacterId);
  }

  return {
    caseMeta: {
      title: def.meta.title,
      tone: def.meta.tone ?? "",
    },
    player: {
      displayName: def.player.displayName,
      role: def.player.role,
      startingKnowledge: def.player.startingKnowledge,
    },
    location: {
      id: location.id,
      name: location.name,
      description: location.description,
      visibleInspectables,
      exits,
      presentCharacters,
    },
    evidenceHeld,
    flagsPublic,
    activeCharacter,
    policy: {
      secondPerson: true,
      closedWorld:
        "Only use locations, characters, and evidence listed here. Do not invent new rooms or killers.",
      noSolution:
        "Do not reveal who the killer is or the full solution. Characters withhold secrets until conditions are met.",
    },
  };
}

function characterSlice(
  def: MysteryDefinition,
  state: PlaythroughState,
  characterId: string
) {
  const c = def.characters.find((ch) => ch.id === characterId);
  if (!c) return undefined;
  const { allowed, mustNotReveal } = allowedKnowledgeForCharacter(
    def,
    state,
    characterId
  );
  const memory = state.characterMemory[characterId];
  return {
    id: c.id,
    name: c.name,
    voice: c.voice ?? "",
    defenses: c.defenses,
    allowedKnowledge: allowed,
    mustNotReveal,
    memorySummary: memory?.summary ?? "",
    recentTurns: memory?.recentTurns ?? [],
  };
}
