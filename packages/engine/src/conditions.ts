import type {
  Condition,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import { hasRelationship } from "./relationships.js";
import {
  characterKnown,
  characterNameKnown,
  isLocationKnown,
} from "./identity.js";

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
      return (
        state.clocks[String(condition.clockId)] !== undefined &&
        (state.clocks[String(condition.clockId)] ?? 1) <= 0
      );
    case "clock_running":
      return (state.clocks[String(condition.clockId)] ?? 0) > 0;
    case "clock_at_most":
      return (
        state.clocks[String(condition.clockId)] !== undefined &&
        (state.clocks[String(condition.clockId)] ?? Infinity) <=
          Number(condition.n)
      );
    case "case_status":
      return state.status === condition.is;
    case "case_active":
      return state.status === "active";
    case "in_denouement":
      return state.status === "denouement";
    case "case_interactive":
      return state.status === "active" || state.status === "denouement";
    case "resolution_outcome":
      return state.resolution?.outcome === condition.is;
    case "resolution_kind":
      return state.resolution?.kind === condition.is;
    case "resolution_path":
      return state.resolution?.path === condition.is;
    case "has_evidence":
    case "inventory_has":
      return state.evidenceIds.includes(
        String(condition.evidenceId ?? condition.itemId)
      );
    case "item_condition": {
      const id = String(condition.itemId ?? condition.objectId);
      const os = state.objectState[id];
      return (os?.condition ?? "intact") === condition.is;
    }
    case "item_flag": {
      const id = String(condition.itemId ?? condition.objectId);
      const os = state.objectState[id];
      return os?.flags?.[String(condition.id)] === condition.equals;
    }
    case "item_has_tag": {
      const id = String(condition.itemId ?? condition.objectId);
      const os = state.objectState[id];
      return (os?.tags ?? []).includes(String(condition.tag));
    }
    case "item_examined_at_least": {
      const id = String(condition.itemId ?? condition.objectId);
      const os = state.objectState[id];
      return (os?.timesExamined ?? 0) >= Number(condition.n ?? condition.value);
    }
    case "item_used_at_least": {
      const id = String(condition.itemId ?? condition.objectId);
      const os = state.objectState[id];
      return (os?.timesUsed ?? 0) >= Number(condition.n ?? condition.value);
    }
    case "item_holder": {
      const id = String(condition.itemId ?? condition.objectId);
      const os = state.objectState[id];
      return (os?.holder ?? "") === String(condition.is ?? condition.holder);
    }
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
    case "character_trust_at_least": {
      const cs = state.characterState[String(condition.characterId)];
      return (cs?.trust ?? 0) >= Number(condition.value);
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
    case "location_known":
      return isLocationKnown(state, String(condition.locationId));
    case "character_known":
      return characterKnown(def, state, String(condition.characterId));
    case "character_name_known":
      return characterNameKnown(def, state, String(condition.characterId));
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
    case "player_not_at":
      return state.locationId !== condition.locationId;
    case "player_threat_is":
      return (state.playerStatus?.threat ?? "none") === condition.is;
    case "player_threat_at_least": {
      const order = ["none", "watched", "threatened", "assaulted"] as const;
      const cur = state.playerStatus?.threat ?? "none";
      const need = String(condition.is ?? condition.threat ?? "none");
      const ci = order.indexOf(cur as (typeof order)[number]);
      const ni = order.indexOf(need as (typeof order)[number]);
      return ci >= 0 && ni >= 0 && ci >= ni;
    }
    case "player_condition_is":
      return (
        (state.playerStatus?.condition ?? "unharmed") ===
        String(condition.is ?? condition.condition)
      );
    case "player_condition_at_least": {
      const order = [
        "unharmed",
        "shaken",
        "bruised",
        "injured",
        "incapacitated",
      ] as const;
      const cur = state.playerStatus?.condition ?? "unharmed";
      const need = String(
        condition.is ?? condition.condition ?? "unharmed"
      );
      const ci = order.indexOf(cur as (typeof order)[number]);
      const ni = order.indexOf(need as (typeof order)[number]);
      return ci >= 0 && ni >= 0 && ci >= ni;
    }
    case "player_control_is":
      return (
        (state.playerStatus?.control ?? "free") ===
        String(condition.is ?? condition.control)
      );
    case "player_control_at_least": {
      const order = [
        "free",
        "held",
        "downed",
        "restrained",
        "unconscious",
      ] as const;
      const cur = state.playerStatus?.control ?? "free";
      const need = String(condition.is ?? condition.control ?? "free");
      const ci = order.indexOf(cur as (typeof order)[number]);
      const ni = order.indexOf(need as (typeof order)[number]);
      return ci >= 0 && ni >= 0 && ci >= ni;
    }
    case "player_not_free":
      return (state.playerStatus?.control ?? "free") !== "free";
    case "player_controlled_by":
      return (
        state.playerStatus?.controlledBy ===
        String(condition.characterId ?? condition.is)
      );
    case "player_safe_haven_compromised":
      return state.playerStatus?.safeHavenCompromised === true;
    case "player_has_tag":
      return (state.playerStatus?.tags ?? []).includes(String(condition.tag));
    case "player_status_flag":
      return (
        state.playerStatus?.flags?.[String(condition.id)] === condition.equals
      );
    case "relationship": {
      const rid = condition.relationshipId
        ? String(condition.relationshipId)
        : undefined;
      if (rid) {
        const rt = state.relationshipState[rid];
        const defEdge = def.relationships.find((r) => r.id === rid);
        if (!defEdge) return false;
        const active = rt?.active ?? defEdge.startsActive;
        if (!active) return false;
        if (condition.relationshipType || condition.edgeType) {
          const want = String(
            condition.relationshipType ?? condition.edgeType
          );
          if (defEdge.type !== want) return false;
        }
        return true;
      }
      return hasRelationship(def, state, {
        fromId: String(condition.fromId),
        toId: String(condition.toId),
        type: condition.relationshipType
          ? String(condition.relationshipType)
          : condition.edgeType
            ? String(condition.edgeType)
            : undefined,
        minStrength:
          condition.minStrength != null
            ? Number(condition.minStrength)
            : undefined,
      });
    }
    case "relationship_known": {
      const rid = String(condition.relationshipId ?? condition.id);
      const rt = state.relationshipState[rid];
      const defEdge = def.relationships.find((r) => r.id === rid);
      if (!defEdge) return false;
      return rt?.knownToPlayer ?? defEdge.knownToPlayerByDefault;
    }
    case "relationship_strength_at_least": {
      const rid = String(condition.relationshipId ?? condition.id);
      const rt = state.relationshipState[rid];
      const defEdge = def.relationships.find((r) => r.id === rid);
      if (!defEdge) return false;
      if (rt && !rt.active) return false;
      const strength = rt?.strength ?? defEdge.strength;
      return strength >= Number(condition.value ?? condition.n ?? 0);
    }
    default:
      return false;
  }
}
