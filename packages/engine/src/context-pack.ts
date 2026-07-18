import type { MysteryDefinition, PlaythroughState } from "@mystery/shared";
import { flagsMatch } from "./flags.js";
import { allowedKnowledgeForCharacter } from "./knowledge.js";

export function buildContextPack(
  def: MysteryDefinition,
  state: PlaythroughState,
  options?: {
    focusCharacterId?: string;
    justHappened?: { id: string; summary: string; narrationHints?: string }[];
    resolvedIntents?: string[];
  }
) {
  const location = def.locations.find((l) => l.id === state.locationId);
  if (!location) {
    throw new Error(`Unknown location ${state.locationId}`);
  }

  const locState = state.locationState[location.id];
  const description = locState?.descriptionAppend
    ? `${location.description} ${locState.descriptionAppend}`
    : location.description;

  const visibleInspectables = location.inspectables
    .filter((i) => flagsMatch(state.flags, i.hiddenUntilFlags))
    .map((i) => {
      const locked = i.objectId
        ? state.objectState[i.objectId]?.locked
        : false;
      const reqEv = i.onInspect.requiresEvidenceIds ?? [];
      const canOpen =
        reqEv.every((id) => state.evidenceIds.includes(id)) && !locked;
      return {
        id: i.id,
        name: i.name,
        narrativeHints: canOpen ? i.onInspect.narrativeHints : undefined,
        locked: locked || (reqEv.length > 0 && !canOpen),
        requiresEvidenceIds: reqEv,
        alreadyCollectedEvidenceIds: (
          i.onInspect.revealsEvidenceIds ?? []
        ).filter((id) => state.evidenceIds.includes(id)),
      };
    });

  const exits = location.exits
    .filter((e) => {
      if (!flagsMatch(state.flags, e.requiresFlags)) return false;
      if (
        e.requiresEvidenceIds?.length &&
        !e.requiresEvidenceIds.every((id) => state.evidenceIds.includes(id))
      ) {
        // still show as locked exit
        return true;
      }
      return true;
    })
    .map((e) => {
      const dest = def.locations.find((l) => l.id === e.toLocationId);
      const key = `${location.id}->${e.toLocationId}`;
      const open =
        locState?.exitOpen[key] ??
        (!e.startsClosed &&
          (e.requiresEvidenceIds ?? []).every((id) =>
            state.evidenceIds.includes(id)
          ) &&
          flagsMatch(state.flags, e.requiresFlags));
      return {
        toLocationId: e.toLocationId,
        label: e.label ?? dest?.name ?? e.toLocationId,
        open,
        requiresEvidenceIds: e.requiresEvidenceIds ?? [],
      };
    });

  // Characters present: definition list OR runtime location match
  const presentIds = new Set<string>();
  for (const p of location.charactersPresent) {
    if (!flagsMatch(state.flags, p.requiresFlags)) continue;
    const cs = state.characterState[p.characterId];
    if (cs && (!cs.available || cs.locationId !== state.locationId)) {
      // runtime overrides definition if they moved away
      if (cs.locationId !== state.locationId) continue;
    }
    presentIds.add(p.characterId);
  }
  for (const [cid, cs] of Object.entries(state.characterState)) {
    if (cs.available && cs.locationId === state.locationId) {
      presentIds.add(cid);
    }
  }

  const presentCharacters = [...presentIds]
    .map((id) => {
      const c = def.characters.find((ch) => ch.id === id);
      const cs = state.characterState[id];
      if (!c || !cs?.available) return null;
      return {
        id: c.id,
        name: c.name,
        shortBio: c.shortBio ?? "",
        willingness: cs.willingness,
        stance: cs.stance,
        pressure: cs.pressure,
        alibiStatus: cs.alibiStatus,
      };
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

  const charactersHereDetailed = presentCharacters
    .map((p) => (p ? characterSlice(def, state, p.id) : null))
    .filter(Boolean);

  const timeLabel =
    def.time?.schedule.find((s) => s.id === state.time?.slotId)?.label ??
    state.time?.slotId;

  return {
    caseMeta: {
      title: def.meta.title,
      tone: def.meta.tone ?? "",
      phase: state.phaseId,
    },
    player: {
      displayName: def.player.displayName,
      role: def.player.role,
      startingKnowledge: def.player.startingKnowledge,
    },
    time: state.time
      ? {
          slotId: state.time.slotId,
          label: timeLabel,
          minutesFromStart: state.time.minutesFromStart,
        }
      : undefined,
    environment: {
      weather: state.environment.weather,
      weatherIntensity: state.environment.weatherIntensity,
      light: state.environment.light,
      ambient: state.environment.ambient,
      crowd: state.environment.crowd,
      activePulses: state.environment.activePulses,
    },
    location: {
      id: location.id,
      name: location.name,
      description,
      visibleInspectables,
      exits,
      presentCharacters,
    },
    evidenceHeld,
    flagsPublic,
    activeCharacter,
    charactersHereDetailed,
    justHappened: options?.justHappened ?? [],
    resolvedIntents: options?.resolvedIntents ?? [],
    policy: {
      secondPerson: true,
      closedWorld:
        "Only use locations, characters, and evidence listed here. Do not invent new rooms or killers.",
      noSolution:
        "Do not reveal who the killer is or the full solution. Characters withhold secrets until conditions are met.",
      defaultDenyKnowledge:
        "Characters may only state facts listed in their allowedKnowledge. Do not invent secret plot facts.",
      respectWillingness:
        "If willingness is silent or hostile, they share little; silent gives almost nothing useful.",
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
  const cs = state.characterState[characterId];
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
    willingness: cs?.willingness ?? "open",
    stance: cs?.stance ?? "",
    pressure: cs?.pressure ?? 0,
    alibiStatus: cs?.alibiStatus ?? "none",
    allowedKnowledge: allowed,
    mustNotReveal,
    memorySummary: memory?.summary ?? "",
    recentTurns: memory?.recentTurns ?? [],
  };
}
