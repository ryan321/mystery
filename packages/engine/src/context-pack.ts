import type { MysteryDefinition, PlaythroughState } from "@mystery/shared";
import { flagsMatch } from "./flags.js";
import { allowedKnowledgeForCharacter } from "./knowledge.js";
import {
  behaviorEdgesForCharacter,
  sceneSocialSurface,
} from "./relationships.js";
import { listInventory } from "./inventory.js";

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

  const inventory = listInventory(def, state);
  /** @deprecated prefer inventory — kept for older prompts */
  const evidenceHeld = inventory.map((i) => ({
    id: i.id,
    name: i.name,
    description: i.description,
    condition: i.condition,
    tags: i.tags,
    flags: i.flags,
    timesExamined: i.timesExamined,
    timesUsed: i.timesUsed,
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

  const presentIdList = presentCharacters
    .map((p) => p?.id)
    .filter(Boolean) as string[];
  if (
    options?.focusCharacterId &&
    !presentIdList.includes(options.focusCharacterId)
  ) {
    presentIdList.push(options.focusCharacterId);
  }

  const socialSurface = sceneSocialSurface(def, state, presentIdList);

  const timeLabel =
    def.time?.schedule.find((s) => s.id === state.time?.slotId)?.label ??
    state.time?.slotId;

  return {
    caseMeta: {
      title: def.meta.title,
      tone: def.meta.tone ?? "",
      phase: state.phaseId,
      caseStatus: state.status,
    },
    /** Public cast directory for name→id (accuse). Never includes guilt. */
    cast: def.characters.map((c) => ({
      id: c.id,
      name: c.name,
      /** Relative portrait path from definition (UI resolves URL). */
      portrait: c.portrait,
    })),
    /**
     * Novel-like social texture for the scene — not a player relationship map.
     * Public or player-known edges among people here.
     */
    socialSurface,
    player: (() => {
      const p = state.playerPersona ?? {
        displayName: def.player.displayName,
        addressAs: def.player.addressAs ?? def.player.displayName,
        role: def.player.role,
        startingKnowledge: def.player.startingKnowledge,
        personaId: def.player.personaId,
        fullName: def.player.fullName,
        pronouns: def.player.pronouns,
        authority: def.player.authority,
        gender: def.player.gender,
        age: def.player.age,
        appearance: def.player.appearance,
        clothing: def.player.clothing,
        background: def.player.background,
        publicPerception: def.player.publicPerception,
        voiceNotes: def.player.voiceNotes,
        performanceNotes: def.player.performanceNotes,
        objective: def.player.objective,
      };
      return {
        /** Recurring persona handle when present (e.g. miss-marple). */
        personaId: p.personaId,
        displayName: p.displayName,
        fullName: p.fullName,
        addressAs: p.addressAs ?? p.displayName,
        pronouns: p.pronouns,
        /** In-mystery role: guest, inspector, patient, … */
        role: p.role,
        authority: p.authority,
        gender: p.gender,
        age: p.age,
        appearance: p.appearance,
        clothing: p.clothing,
        background: p.background,
        publicPerception: p.publicPerception,
        voiceNotes: p.voiceNotes,
        performanceNotes: p.performanceNotes,
        objective: p.objective,
        startingKnowledge:
          p.startingKnowledge ?? def.player.startingKnowledge,
        status: {
          threat: state.playerStatus?.threat ?? "none",
          safeHavenCompromised:
            state.playerStatus?.safeHavenCompromised ?? false,
          tags: state.playerStatus?.tags ?? [],
          flags: state.playerStatus?.flags ?? {},
        },
      };
    })(),
    resolution: state.resolution,
    /**
     * Informal accusation awaiting formal commitment. Present only while the
     * player has named a suspect but not confirmed. Never implies guilt.
     */
    pendingAccusation: state.pendingAccusation
      ? {
          summary: state.pendingAccusation.summary,
          suspectIds: state.pendingAccusation.suspectIds,
          suspectNames: state.pendingAccusation.suspectIds.map(
            (id) => def.characters.find((c) => c.id === id)?.name ?? id
          ),
          method: state.pendingAccusation.method,
          motive: state.pendingAccusation.motive,
          turnsRemaining: Math.max(
            0,
            state.pendingAccusation.expiresAfterTurn - state.turnCount
          ),
        }
      : undefined,
    denouement:
      state.status === "denouement" && state.denouement
        ? {
            turnsRemaining: state.denouement.turnsRemaining,
            maxTurns: state.denouement.maxTurns,
            allowEarlyExit: def.wrapUp?.allowEarlyExit !== false,
          }
        : undefined,
    ending:
      state.status !== "active" && state.endingId
        ? (() => {
            const e = def.endings.find((x) => x.id === state.endingId);
            return e
              ? {
                  id: e.id,
                  when: e.when,
                  kind: e.kind,
                  title: e.title,
                  templateNotes: e.templateNotes,
                }
              : { id: state.endingId };
          })()
        : undefined,
    clocks: Object.fromEntries(
      Object.entries(state.clocks).map(([k, v]) => [
        k,
        { turnsRemaining: v, expired: v <= 0 },
      ])
    ),
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
    /** Full inventory with per-item state (condition, tags, flags, uses). */
    inventory,
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
      playerPersona:
        "player.* is who the human is in this story (name, role, appearance, authority). Second person still — address them as that person. NPCs must treat them according to role, authority, and publicPerception (a dinner guest is not a badge; an official may open doors; a patient may be dismissed). Use addressAs in dialogue. Do not invent a different identity, gender, age, or backstory. If personaId is set, this may be a recurring detective known across cases — stay consistent with background/appearance.",
      detectiveAsTarget:
        "Player status (threat, safeHavenCompromised, tags) is engine-owned. Perform pressure already in status and justHappened. Do not invent new attacks, break-ins, or thefts unless listed in justHappened or status.",
      denouement:
        state.status === "denouement"
          ? "WRAP-UP MODE: The case has been judged (see resolution/ending). Stay interactive: characters react, the accused may confess or rage, household falls out. Player may still talk, look, move, and leave. Do NOT treat the mystery as unsolved. Do NOT invent a new killer. Consequences matter."
          : "Investigation mode: solution sealed until judged.",
      socialGraph:
        "socialSurface and per-character relationships shape behavior and subtext. Private edges (public:false, knownToPlayer:false) inform how people act — do NOT lecture the player about them unless a character would say so. No relationship HUD; reveal bonds in prose and dialogue like a novel.",
      accusations: state.pendingAccusation
        ? "pendingAccusation is present: the player has voiced a theory but NOT formally committed. Nothing has been judged. Ask in-fiction whether they commit; do not confirm, deny, or resolve the theory."
        : "Only a formal, confirmed accusation decides the case. Informal theories are conversation, not judgment.",
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
  const relationships = behaviorEdgesForCharacter(def, state, characterId);
  const privateRelNotes = relationships
    .filter((r) => !r.public && !r.knownToPlayer)
    .map(
      (r) =>
        `[private behavior only] ${r.direction === "out" ? "→" : "←"} ${r.type}: ${r.label}${r.notes ? ` — ${r.notes}` : ""}`
    );
  const speakableRels = relationships
    .filter((r) => r.public || r.knownToPlayer)
    .map((r) => ({
      id: r.id,
      type: r.type,
      label: r.label,
      strength: r.strength,
      withId: r.direction === "out" ? r.toId : r.fromId,
      direction: r.direction,
    }));

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
    mustNotReveal: [...mustNotReveal, ...privateRelNotes],
    /** Bonds they may acknowledge or that are already social knowledge */
    relationships: speakableRels,
    /**
     * Full bond list for acting (includes private). Prefer subtext over exposition.
     */
    relationshipBehavior: relationships.map((r) => ({
      id: r.id,
      type: r.type,
      label: r.label,
      strength: r.strength,
      public: r.public,
      knownToPlayer: r.knownToPlayer,
      withId: r.direction === "out" ? r.toId : r.fromId,
      direction: r.direction,
      notes: r.notes,
    })),
    memorySummary: memory?.summary ?? "",
    recentTurns: memory?.recentTurns ?? [],
  };
}
