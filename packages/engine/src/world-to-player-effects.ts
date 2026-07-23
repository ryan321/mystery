/**
 * Engine allowlist: what free-text / AI may do TO the player (and light NPC reactions).
 * Situations are open-ended; tools are fixed.
 */

import type {
  Effect,
  JustHappened,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import { applyEffects } from "./effects.js";
import { authoredFlagKeys, RESERVED_FLAGS } from "./flags.js";

/** Effects the director may propose for world→player (and immediate reactions). */
export const WORLD_TO_PLAYER_EFFECT_TYPES = new Set([
  "move_player",
  "set_player_location",
  "set_player_threat",
  "set_player_condition",
  "harm_player",
  "hold_player",
  "knock_down_player",
  "restrain_player",
  "knock_out_player",
  "release_player",
  "set_player_control",
  "steal_from_player",
  "remove_evidence",
  "set_item_condition",
  "add_player_tag",
  "set_player_status_flag",
  "set_safe_haven_compromised",
  "set_game_flag",
  "notebook_append",
  "append_location_description",
  "set_ambient",
  "set_willingness",
  "add_pressure",
  "set_stance",
  "move_character",
  "start_clock",
]);

export function isWorldToPlayerEffectType(type: string): boolean {
  return WORLD_TO_PLAYER_EFFECT_TYPES.has(type);
}

/**
 * Validate AI-proposed effects: type allowlist + closed-world ids.
 * Drops anything illegal; never invents.
 */
export function sanitizeWorldToPlayerEffects(
  def: MysteryDefinition,
  effects: Effect[]
): { ok: Effect[]; rejected: string[] } {
  const ok: Effect[] = [];
  const rejected: string[] = [];
  const locationIds = new Set(def.locations.map((l) => l.id));
  const characterIds = new Set(def.characters.map((c) => c.id));
  const evidenceIds = new Set(def.evidence.map((e) => e.id));
  const authoredFlags = authoredFlagKeys(def);

  for (const raw of effects) {
    if (!raw || typeof raw !== "object") continue;
    const type = String(raw.type ?? "");
    if (!isWorldToPlayerEffectType(type)) {
      rejected.push(`blocked effect type: ${type}`);
      continue;
    }
    const e: Effect = { ...raw, type };

    // Engine-owned and authored flags are off-limits to AI-proposed effects: a
    // set_game_flag targeting case_solved/case_failed would flip the confession
    // gate and leak the sealed solution, and one targeting an authored progress
    // flag would desync the world (see flags.ts RESERVED_FLAGS / authoredFlagKeys).
    if (type === "set_game_flag" || type === "set_game_flag_true") {
      const flagId = String((e as { id?: unknown }).id ?? "");
      if (RESERVED_FLAGS.has(flagId)) {
        rejected.push(`blocked reserved flag on ${type}`);
        continue;
      }
      if (authoredFlags.has(flagId)) {
        rejected.push(`blocked authored flag on ${type}`);
        continue;
      }
    }

    const toLoc = e.toLocationId != null ? String(e.toLocationId) : undefined;
    if (toLoc && toLoc !== "$player" && toLoc !== "player" && !locationIds.has(toLoc)) {
      rejected.push(`unknown location ${toLoc} on ${type}`);
      continue;
    }
    const locId = e.locationId != null ? String(e.locationId) : undefined;
    if (locId && !locationIds.has(locId)) {
      rejected.push(`unknown location ${locId} on ${type}`);
      continue;
    }
    const cid =
      e.characterId != null
        ? String(e.characterId)
        : e.byCharacterId != null
          ? String(e.byCharacterId)
          : undefined;
    if (
      cid &&
      (type === "move_character" ||
        type === "set_willingness" ||
        type === "add_pressure" ||
        type === "set_stance" ||
        type === "hold_player" ||
        type === "knock_down_player" ||
        type === "restrain_player" ||
        type === "knock_out_player") &&
      !characterIds.has(cid)
    ) {
      rejected.push(`unknown character ${cid} on ${type}`);
      continue;
    }
    const item =
      e.itemId != null
        ? String(e.itemId)
        : e.evidenceId != null
          ? String(e.evidenceId)
          : e.objectId != null
            ? String(e.objectId)
            : undefined;
    if (
      item &&
      (type === "steal_from_player" ||
        type === "remove_evidence" ||
        type === "set_item_condition") &&
      !evidenceIds.has(item)
    ) {
      // steal prefer lists may still work; single bad id skip
      if (!Array.isArray(e.preferItemIds)) {
        rejected.push(`unknown item ${item} on ${type}`);
        continue;
      }
    }

    ok.push(e);
  }
  return { ok, rejected };
}

export function applyDirectorWorldToPlayerEffects(
  def: MysteryDefinition,
  state: PlaythroughState,
  opts: {
    summary?: string;
    effects: Effect[];
    caseHandled: boolean;
  }
): { state: PlaythroughState; justHappened: JustHappened[]; rejected: string[] } {
  if (opts.caseHandled || !opts.effects.length) {
    return { state, justHappened: [], rejected: [] };
  }
  if (state.status !== "active" && state.status !== "denouement") {
    return { state, justHappened: [], rejected: [] };
  }

  const { ok, rejected } = sanitizeWorldToPlayerEffects(def, opts.effects);
  if (!ok.length) {
    return { state, justHappened: [], rejected };
  }

  const applied = applyEffects(def, state, ok);
  const framing: JustHappened = {
    id: "world_to_player",
    summary: opts.summary?.trim() || "The world acts on you",
    narrationHints: [
      "WORLD→PLAYER (engine-applied AI effects):",
      opts.summary?.trim() || "Something happens TO the player this turn.",
      `Applied effects: ${ok.map((e) => e.type).join(", ")}.`,
      "Stage these as real events in second person. Honor player.status and location after effects.",
      "Do not invent further attacks, rooms, or evidence beyond status + justHappened.",
    ].join(" "),
  };

  return {
    state: applied.state,
    justHappened: [framing, ...applied.justHappened],
    rejected,
  };
}
