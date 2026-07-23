import type {
  MysteryDefinition,
  PlaythroughState,
  CharacterRuntimeState,
  ObjectRuntimeState,
  LocationRuntimeState,
  PlayerCharacterKnowledge,
  RelationshipRuntimeState,
} from "@mystery/shared";
import { snapshotPlayerPersona } from "@mystery/shared";
import { randomUUID } from "node:crypto";

export function createInitialPlaythrough(
  def: MysteryDefinition,
  id: string = randomUUID()
): PlaythroughState {
  const now = new Date().toISOString();
  const flags: PlaythroughState["flags"] = {};
  for (const f of def.flags) {
    if (f.defaultValue !== undefined) {
      flags[f.id] = f.defaultValue;
    }
  }

  const characterState: Record<string, CharacterRuntimeState> = {};
  for (const c of def.characters) {
    const defaultLoc =
      c.defaultLocationId ??
      def.locations.find((l) =>
        l.charactersPresent.some((p) => p.characterId === c.id)
      )?.id ??
      def.player.startingLocationId;
    const isVictim = c.storyRole === "victim";
    // Hidden characters with an "appear" entrance stay offstage until it fires.
    const hiddenUntilEntrance =
      c.knownAtStart === false && c.entrance?.mode !== "mention";
    const available =
      c.availableByDefault !== undefined
        ? c.availableByDefault
        : !isVictim && !hiddenUntilEntrance;
    characterState[c.id] = {
      locationId: defaultLoc,
      available,
      willingness: isVictim
        ? "silent"
        : (c.defaultWillingness ?? "open"),
      pressure: 0,
      trust: 0,
      stance: c.defaultStance ?? (isVictim ? "deceased" : ""),
      alibiStatus: "none",
      timesTalked: 0,
      dressing: [],
    };
  }

  const relationshipState: Record<string, RelationshipRuntimeState> = {};
  for (const rel of def.relationships) {
    relationshipState[rel.id] = {
      active: rel.startsActive ?? true,
      strength: rel.strength ?? 1,
      knownToPlayer: rel.knownToPlayerByDefault ?? false,
      flags: {},
    };
  }

  const objectState: Record<string, ObjectRuntimeState> = {};
  for (const e of def.evidence) {
    const held = def.player.startingEvidenceIds.includes(e.id);
    objectState[e.id] = {
      stage: held ? "taken" : "visible",
      locked: false,
      locationId: held ? undefined : e.discoverableAt?.locationId,
      holder: held ? "player" : undefined,
      condition: "intact",
      tags: [],
      flags: {},
      timesExamined: 0,
      timesUsed: 0,
      dressing: [],
    };
  }
  // locked containers from inspectables (container.locked or legacy key list)
  for (const loc of def.locations) {
    for (const insp of loc.inspectables) {
      if (insp.objectId) {
        const locked =
          insp.container?.locked === true ||
          (insp.onInspect.requiresEvidenceIds?.length ?? 0) > 0;
        objectState[insp.objectId] = {
          stage: "visible",
          locked,
          locationId: loc.id,
          condition: "intact",
          tags: [],
          flags: {},
          timesExamined: 0,
          timesUsed: 0,
          dressing: [],
        };
      }
    }
  }

  const locationState: Record<string, LocationRuntimeState> = {};
  for (const loc of def.locations) {
    const exitOpen: Record<string, boolean> = {};
    for (const exit of loc.exits) {
      const key = `${loc.id}->${exit.toLocationId}`;
      exitOpen[key] = !exit.startsClosed;
    }
    locationState[loc.id] = {
      accessible: loc.startsAccessible ?? true,
      descriptionAppend: "",
      exitOpen,
      dressing: [],
      // Fog-of-war seed: persona familiarity + where you start.
      known:
        (loc.knownAtStart ?? false) ||
        loc.id === def.player.startingLocationId,
    };
  }

  // Identity + existence knowledge at turn 0. A hidden character standing
  // in the starting room is immediately known (they're met on arrival).
  const playerKnowledge: Record<string, PlayerCharacterKnowledge> = {};
  for (const c of def.characters) {
    const nameKnown = c.nameKnownAtStart ?? true;
    const cs = characterState[c.id];
    const coPresent =
      cs?.available === true &&
      cs.locationId === def.player.startingLocationId;
    playerKnowledge[c.id] = {
      known: (c.knownAtStart ?? true) || coPresent,
      knownAs: nameKnown ? c.name : c.introducedAs ?? c.name,
      nameKnown,
    };
  }

  const env = def.environment ?? {
    weather: "storm",
    light: "night",
    crowd: "none",
    flags: {},
  };

  let time: PlaythroughState["time"];
  if (def.time) {
    const start =
      def.time.schedule.find((s) => s.id === def.time!.startSlotId) ??
      def.time.schedule[0]!;
    time = {
      slotId: start.id,
      minutesFromStart: start.minutesFromStart,
      reachedSlotIdsThisTurn: [],
    };
  }

  const phaseId = def.phases[0]?.id ?? "arrival";

  return {
    id,
    caseId: def.id,
    contentVersion: def.contentVersion,
    status: "active",
    locationId: def.player.startingLocationId,
    evidenceIds: [...def.player.startingEvidenceIds],
    flags,
    notebook: [],
    characterMemory: {},
    visitedLocationIds: [def.player.startingLocationId],
    turnCount: 0,
    createdAt: now,
    updatedAt: now,
    phaseId,
    firedBeatIds: [],
    beatQueue: [],
    clocks: {},
    characterState,
    relationshipState,
    objectState,
    locationState,
    environment: {
      weather: env.weather ?? "clear",
      weatherIntensity: env.weatherIntensity,
      light: env.light ?? "day",
      ambient: env.ambient,
      crowd: env.crowd ?? "none",
      flags: { ...(env.flags ?? {}) },
      activePulses: [],
    },
    time,
    presented: [],
    playerKnowledge,
    playerStatus: {
      threat: "none",
      condition: "unharmed",
      control: "free",
      safeHavenCompromised: false,
      tags: [],
      flags: {},
    },
    playerPersona: snapshotPlayerPersona(def.player),
  };
}
