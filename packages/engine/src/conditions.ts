import type {
  Condition,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";

function slotIndex(def: MysteryDefinition, slotId: string): number {
  if (!def.time) return -1;
  return def.time.schedule.findIndex((s) => s.id === slotId);
}

/**
 * Evaluate a condition against current playthrough + definition.
 */
export function evaluateCondition(
  def: MysteryDefinition,
  state: PlaythroughState,
  condition: Condition
): boolean {
  const t = condition.type;
  switch (t) {
    case "always":
      return true;
    case "never":
      return false;
    case "and": {
      const of = (condition.of as Condition[]) ?? [];
      return of.every((c) => evaluateCondition(def, state, c));
    }
    case "or": {
      const of = (condition.of as Condition[]) ?? [];
      return of.some((c) => evaluateCondition(def, state, c));
    }
    case "not":
      return !evaluateCondition(def, state, condition.of as Condition);
    case "phase_is":
      return state.phaseId === condition.phaseId;
    case "turn_at_least":
      return state.turnCount >= Number(condition.n);
    case "game_flag":
      return state.flags[String(condition.id)] === condition.equals;
    case "beat_fired":
      return state.firedBeatIds.includes(String(condition.beatId));
    case "clock_expired":
      return (state.clocks[String(condition.clockId)] ?? 1) <= 0;
    case "has_evidence":
      return state.evidenceIds.includes(String(condition.evidenceId));
    case "visited":
      return state.visitedLocationIds.includes(String(condition.locationId));
    case "presented":
      return state.presented.some(
        (p) =>
          p.evidenceId === condition.evidenceId &&
          p.characterId === condition.toCharacterId
      );
    case "talked_to": {
      const cs = state.characterState[String(condition.characterId)];
      const times = cs?.timesTalked ?? 0;
      return times >= Number(condition.minTimes ?? 1);
    }
    case "character_willingness": {
      const cs = state.characterState[String(condition.characterId)];
      return (cs?.willingness ?? "open") === condition.is;
    }
    case "character_pressure_at_least": {
      const cs = state.characterState[String(condition.characterId)];
      return (cs?.pressure ?? 0) >= Number(condition.value);
    }
    case "character_at": {
      const cs = state.characterState[String(condition.characterId)];
      return cs?.locationId === condition.locationId;
    }
    case "object_stage": {
      const os = state.objectState[String(condition.objectId)];
      return (os?.stage ?? "visible") === condition.is;
    }
    case "object_unlocked": {
      const os = state.objectState[String(condition.objectId)];
      return os ? os.locked === false : true;
    }
    case "location_accessible": {
      const ls = state.locationState[String(condition.locationId)];
      return ls?.accessible ?? true;
    }
    case "exit_open": {
      const from = String(condition.from);
      const to = String(condition.to);
      const key = `${from}->${to}`;
      const ls = state.locationState[from];
      if (ls?.exitOpen[key] !== undefined) return ls.exitOpen[key];
      const loc = def.locations.find((l) => l.id === from);
      const exit = loc?.exits.find((e) => e.toLocationId === to);
      if (!exit) return false;
      return !exit.startsClosed;
    }
    case "time_slot_is":
      return state.time?.slotId === condition.slotId;
    case "time_at_least": {
      if (!state.time || !def.time) return false;
      const need = slotIndex(def, String(condition.slotId));
      const cur = slotIndex(def, state.time.slotId);
      return need >= 0 && cur >= need;
    }
    case "time_reached":
      return (
        state.time?.reachedSlotIdsThisTurn.includes(
          String(condition.slotId)
        ) ?? false
      );
    case "time_minutes_at_least":
      return (state.time?.minutesFromStart ?? 0) >= Number(condition.n);
    case "weather_is":
      return state.environment.weather === condition.weather;
    case "environment_flag":
      return (
        state.environment.flags[String(condition.id)] === condition.equals
      );
    case "crowd_is":
      return state.environment.crowd === condition.level;
    case "player_at":
      return state.locationId === condition.locationId;
    default:
      return false;
  }
}
