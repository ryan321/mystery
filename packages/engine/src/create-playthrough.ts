import type {
  MysteryDefinition,
  PlaythroughState,
  CharacterRuntimeState,
  ObjectRuntimeState,
  LocationRuntimeState,
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
    const available =
      c.availableByDefault !== undefined
        ? c.availableByDefault
        : !isVictim;
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
    };
  }
  // locked containers from inspectables with objectId
  for (const loc of def.locations) {
    for (const insp of loc.inspectables) {
      if (insp.objectId) {
        objectState[insp.objectId] = {
          stage: "visible",
          locked: (insp.onInspect.requiresEvidenceIds?.length ?? 0) > 0,
          locationId: loc.id,
          condition: "intact",
          tags: [],
          flags: {},
          timesExamined: 0,
          timesUsed: 0,
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
