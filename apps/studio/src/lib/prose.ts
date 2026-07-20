import type { Condition, Effect } from "@mystery/shared";

/**
 * Human-readable rendering of the mystery's "programming language" —
 * conditions and effects — so the plot graph reads like a story outline.
 */

function s(v: unknown): string {
  return String(v ?? "?");
}

export function conditionToText(c: Condition | undefined): string {
  if (!c) return "always";
  const t = c.type;
  switch (t) {
    case "always":
      return "always";
    case "never":
      return "never";
    case "and":
      return (c.of as Condition[]).map(conditionToText).join(" AND ");
    case "or":
      return "(" + (c.of as Condition[]).map(conditionToText).join(" OR ") + ")";
    case "not":
      return `NOT (${conditionToText(c.of as Condition)})`;
    case "phase_is":
      return `phase is “${s(c.phaseId)}”`;
    case "turn_at_least":
      return `turn ≥ ${s(c.n)}`;
    case "game_flag":
      return `flag ${s(c.id)} = ${s(c.equals)}`;
    case "beat_fired":
      return `after beat “${s(c.beatId)}”`;
    case "case_active":
      return "case still active";
    case "in_denouement":
      return "during wrap-up";
    case "clock_expired":
      return `clock “${s(c.clockId)}” has run out`;
    case "clock_running":
      return `clock “${s(c.clockId)}” still running`;
    case "time_slot_is":
      return `time is “${s(c.slotId)}”`;
    case "time_at_least":
      return `time ≥ “${s(c.slotId)}”`;
    case "time_reached":
      return `the moment “${s(c.slotId)}” arrives`;
    case "has_evidence":
    case "inventory_has":
      return `player holds ${s(c.evidenceId ?? c.itemId)}`;
    case "visited":
      return `player has visited ${s(c.locationId)}`;
    case "presented":
      return `${s(c.evidenceId)} shown to ${s(c.toCharacterId)}`;
    case "talked_to":
      return `talked to ${s(c.characterId)}${c.minTimes ? ` ×${s(c.minTimes)}` : ""}`;
    case "player_at":
      return `player in ${s(c.locationId)}`;
    case "player_not_at":
      return `player NOT in ${s(c.locationId)}`;
    case "character_willingness":
      return `${s(c.characterId)} is ${s(c.is)}`;
    case "character_pressure_at_least":
      return `${s(c.characterId)} pressure ≥ ${s(c.value)}`;
    case "character_at":
      return `${s(c.characterId)} in ${s(c.locationId)}`;
    case "character_known":
      return `player knows ${s(c.characterId)} exists`;
    case "character_name_known":
      return `player knows ${s(c.characterId)}'s name`;
    case "location_known":
      return `player knows of ${s(c.locationId)}`;
    case "object_unlocked":
      return `${s(c.objectId)} unlocked`;
    case "object_stage":
      return `${s(c.objectId)} is ${s(c.is)}`;
    case "weather_is":
      return `weather is ${s(c.weather)}`;
    case "resolution_outcome":
      return `judged: ${s(c.is)}`;
    case "player_threat_at_least":
      return `threat ≥ ${s(c.is ?? c.threat)}`;
    case "relationship_known":
      return `player knows bond “${s(c.relationshipId ?? c.id)}”`;
    default:
      return `${t}(${Object.entries(c)
        .filter(([k]) => k !== "type")
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(", ")})`;
  }
}

export function effectToText(e: Effect): string {
  const t = e.type;
  switch (t) {
    case "set_game_flag":
      return `set flag ${s(e.id)} = ${s(e.value)}`;
    case "set_phase":
      return `enter phase “${s(e.phaseId)}”`;
    case "start_clock":
      return `start clock “${s(e.clockId)}” (${s(e.turns)} turns)`;
    case "queue_beat":
      return `queue beat “${s(e.beatId)}”${e.delayTurns ? ` in ${s(e.delayTurns)} turns` : ""}`;
    case "end_case":
      return `END CASE — ${s(e.outcome ?? "failure")}${e.endingId ? ` (${s(e.endingId)})` : ""}`;
    case "advance_time":
      return e.toSlotId
        ? `time jumps to “${s(e.toSlotId)}”`
        : `time advances ${s(e.byMinutes)} min`;
    case "set_weather":
      return `weather → ${s(e.weather)}`;
    case "set_light":
      return `light → ${s(e.light)}`;
    case "set_ambient":
      return `mood → ${s(e.ambient)}`;
    case "pulse_environment":
      return `one-shot: ${s(e.tag)}`;
    case "set_willingness":
      return `${s(e.characterId)} becomes ${s(e.value)}`;
    case "set_stance":
      return `${s(e.characterId)} stance → ${s(e.value)}`;
    case "add_pressure":
      return `${s(e.characterId)} pressure +${s(e.by)}`;
    case "add_trust":
      return `${s(e.characterId)} trust +${s(e.by ?? e.value ?? 1)}`;
    case "move_character":
      return `${s(e.characterId)} moves to ${s(e.toLocationId)}`;
    case "set_character_available":
      return e.value
        ? `${s(e.characterId)} becomes available`
        : `${s(e.characterId)} leaves the stage`;
    case "reveal_knowledge":
      return `${s(e.characterId)} may now share “${s(e.knowledgeId)}”`;
    case "reveal_character":
      return `player learns ${s(e.characterId)} exists`;
    case "reveal_character_name":
      return `player learns ${s(e.characterId)}'s real name`;
    case "set_known_as":
      return `${s(e.characterId)} now known as “${s(e.label)}”`;
    case "reveal_location":
      return `${s(e.locationId)} appears on the map`;
    case "set_alibi_status":
      return `${s(e.characterId)}'s alibi: ${s(e.value)}`;
    case "grant_evidence":
      return `player gains ${s(e.evidenceId ?? e.itemId)}`;
    case "remove_evidence":
      return `player loses ${s(e.evidenceId ?? e.itemId)}`;
    case "steal_from_player":
      return `something is stolen from the player`;
    case "set_object_locked":
      return e.value ? `${s(e.objectId)} locks` : `${s(e.objectId)} unlocks`;
    case "set_exit_open":
      return `${s(e.from)} → ${s(e.to)} ${e.value ? "opens" : "closes"}`;
    case "set_location_accessible":
      return `${s(e.locationId)} ${e.value ? "opens up" : "is sealed off"}`;
    case "append_location_description":
      return `${s(e.locationId)} changes: “${s(e.text).slice(0, 60)}…”`;
    case "move_player":
    case "set_player_location":
      return `player is taken to ${s(e.toLocationId ?? e.locationId)}`;
    case "set_player_threat":
      return `player threat → ${s(e.threat ?? e.value)}`;
    case "harm_player":
    case "set_player_condition":
      return `player is hurt (${s(e.condition ?? e.value)})`;
    case "hold_player":
      return "player is grabbed";
    case "knock_down_player":
      return "player is knocked down";
    case "restrain_player":
      return "player is restrained";
    case "knock_out_player":
      return "player is knocked out";
    case "release_player":
      return "player is released";
    case "set_safe_haven_compromised":
      return "player's room is violated";
    case "add_player_tag":
      return `player tagged “${s(e.tag)}”`;
    case "notebook_append":
      return `notebook: “${s(e.text).slice(0, 60)}”`;
    case "reveal_relationship":
      return `bond revealed: ${s(e.relationshipId ?? e.id)}`;
    case "set_relationship":
    case "set_relationship_active":
    case "set_relationship_strength":
      return `bond ${s(e.relationshipId ?? e.id)} changes`;
    case "end_denouement":
    case "finalize_case":
      return "wrap-up ends";
    default:
      return t;
  }
}
