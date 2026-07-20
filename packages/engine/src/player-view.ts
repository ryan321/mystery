import type { MysteryDefinition, PlaythroughState } from "@mystery/shared";
import { flagsMatch } from "./flags.js";
import { listInventory } from "./inventory.js";
import {
  characterKnown,
  characterNameKnown,
  isLocationKnown,
  knownAsFor,
} from "./identity.js";

/**
 * UI-safe projection of a playthrough (PLAYER_SURFACES.md §5–7).
 *
 * NOT the ContextPack. The ContextPack is narrator-safe, not player-safe —
 * it carries inspectable narrativeHints, character voice/defenses,
 * allowedKnowledge, and private relationship behavior notes. None of that
 * may reach the browser. This projector emits only what the player
 * surfaces render:
 *
 *  - scene: location, exits (open state, no requirement ids), presence
 *    (knownAs labels), visible object names
 *  - cast: dramatis personae (knownAs, role, bio only once name is known)
 *  - inventory: held items (no item flags)
 *  - map: fog of war — known locations only
 *  - notebook, opening package, time/weather, player status
 *
 * Surfaces render state; they never grant it.
 */
export function buildPlayerView(
  def: MysteryDefinition,
  state: PlaythroughState
) {
  const location = def.locations.find((l) => l.id === state.locationId);
  if (!location) {
    throw new Error(`Unknown location ${state.locationId}`);
  }

  const locState = state.locationState[location.id];
  const description = locState?.descriptionAppend
    ? `${location.description} ${locState.descriptionAppend}`
    : location.description;

  const exits = location.exits
    .filter((e) => flagsMatch(state.flags, e.requiresFlags))
    .map((e) => {
      const key = `${location.id}->${e.toLocationId}`;
      const dest = def.locations.find((l) => l.id === e.toLocationId);
      const open =
        locState?.exitOpen[key] ??
        (!e.startsClosed &&
          (e.requiresEvidenceIds ?? []).every((id) =>
            state.evidenceIds.includes(id)
          ));
      return {
        toLocationId: e.toLocationId,
        label: e.label ?? dest?.name ?? e.toLocationId,
        open,
        destinationKnown: isLocationKnown(state, e.toLocationId),
      };
    });

  const present = Object.entries(state.characterState)
    .filter(([, cs]) => cs.available && cs.locationId === state.locationId)
    .map(([cid]) => {
      const c = def.characters.find((ch) => ch.id === cid);
      if (!c) return null;
      return {
        id: c.id,
        knownAs: knownAsFor(def, state, c.id),
        storyRole: c.storyRole ?? "suspect",
        portrait: c.portrait,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const objects = location.inspectables
    .filter((i) => flagsMatch(state.flags, i.hiddenUntilFlags))
    .map((i) => ({
      id: i.id,
      name: i.name,
      locked: i.objectId
        ? state.objectState[i.objectId]?.locked === true
        : false,
    }));

  // Dramatis personae grows as the story introduces people: hidden
  // characters (knownAtStart: false) are absent until revealed or met.
  const presentIds = new Set(present.map((p) => p.id));
  const cast = def.characters
    .filter(
      (c) => characterKnown(def, state, c.id) || presentIds.has(c.id)
    )
    .map((c) => {
      const nameKnown = characterNameKnown(def, state, c.id);
      return {
        id: c.id,
        knownAs: knownAsFor(def, state, c.id),
        nameKnown,
        storyRole: c.storyRole ?? "suspect",
        portrait: c.portrait,
        // shortBio may contain the real name — front matter only once known.
        bio: nameKnown ? c.shortBio ?? "" : "",
      };
    });

  const inventory = listInventory(def, state).map((i) => ({
    id: i.id,
    name: i.name,
    description: i.description,
    condition: i.condition,
    tags: i.tags,
  }));

  const mapLocations = def.locations
    .filter((l) => isLocationKnown(state, l.id))
    .map((l) => ({
      id: l.id,
      name: l.name,
      visited: state.visitedLocationIds.includes(l.id),
      x: l.map?.x,
      y: l.map?.y,
      floor: l.map?.floor,
      image: l.image,
    }));

  // Map edges: doors the player has actually seen — exits of VISITED rooms
  // only (a room known by hearsay has an unknown interior). An exit to an
  // unknown destination is a "door you haven't taken" stub for the UI.
  const knownIds = new Set(mapLocations.map((l) => l.id));
  const connections: {
    from: string;
    to: string;
    open: boolean;
    destinationKnown: boolean;
  }[] = [];
  for (const l of def.locations) {
    if (!state.visitedLocationIds.includes(l.id) || !knownIds.has(l.id)) {
      continue;
    }
    const ls = state.locationState[l.id];
    for (const e of l.exits) {
      if (!flagsMatch(state.flags, e.requiresFlags)) continue;
      const key = `${l.id}->${e.toLocationId}`;
      const open =
        ls?.exitOpen[key] ??
        (!e.startsClosed &&
          (e.requiresEvidenceIds ?? []).every((id) =>
            state.evidenceIds.includes(id)
          ));
      connections.push({
        from: l.id,
        to: e.toLocationId,
        open,
        destinationKnown: knownIds.has(e.toLocationId),
      });
    }
  }

  const openingPackage =
    def.player.briefing ??
    ({
      form: "custom" as const,
      title: def.meta.title,
      sections: [
        ...(def.meta.premise
          ? [{ heading: "The situation", text: def.meta.premise }]
          : []),
        ...(def.player.startingKnowledge
          ? [{ heading: "What you know", text: def.player.startingKnowledge }]
          : []),
        ...(def.player.objective
          ? [{ heading: "Your objective", text: def.player.objective }]
          : []),
      ],
    });

  const persona = state.playerPersona;
  const timeLabel = def.time?.schedule.find(
    (s) => s.id === state.time?.slotId
  )?.label;

  return {
    caseId: def.id,
    title: def.meta.title,
    caseStatus: state.status,
    turnCount: state.turnCount,
    player: {
      displayName: persona?.displayName ?? def.player.displayName,
      addressAs:
        persona?.addressAs ?? def.player.addressAs ?? def.player.displayName,
      role: persona?.role ?? def.player.role,
      objective: persona?.objective ?? def.player.objective,
      status: {
        condition: state.playerStatus?.condition ?? "unharmed",
        control: state.playerStatus?.control ?? "free",
        threat: state.playerStatus?.threat ?? "none",
      },
    },
    openingPackage,
    scene: {
      locationId: location.id,
      name: location.name,
      description,
      image: location.image,
      exits,
      present,
      objects,
    },
    cast,
    inventory,
    map: {
      currentLocationId: state.locationId,
      locations: mapLocations,
      connections,
    },
    notebook: state.notebook,
    time: state.time
      ? { slotId: state.time.slotId, label: timeLabel ?? state.time.slotId }
      : undefined,
    environment: {
      weather: state.environment.weather,
      light: state.environment.light,
      ambient: state.environment.ambient,
      crowd: state.environment.crowd,
    },
    pendingAccusation: state.pendingAccusation
      ? {
          summary: state.pendingAccusation.summary,
          suspectNames: state.pendingAccusation.suspectIds.map((id) =>
            knownAsFor(def, state, id)
          ),
          turnsRemaining: Math.max(
            0,
            state.pendingAccusation.expiresAfterTurn - state.turnCount
          ),
        }
      : undefined,
    ending:
      state.status !== "active" && state.endingId
        ? (() => {
            const e = def.endings.find((x) => x.id === state.endingId);
            // templateNotes are performer guidance — never shipped to UI.
            return e
              ? { id: e.id, when: e.when, kind: e.kind, title: e.title }
              : { id: state.endingId };
          })()
        : undefined,
  };
}
export type PlayerView = ReturnType<typeof buildPlayerView>;
