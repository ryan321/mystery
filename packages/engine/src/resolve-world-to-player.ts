/**
 * WORLD → PLAYER — core engine phase
 * ───────────────────────────────────
 * After the player acts (patch + beats), the engine applies what the world
 * does TO the player.
 *
 * Situations are open-ended (AI + authors invent them). The engine only
 * knows fixed *tools* (effects): move, harm, hold, steal, threat, etc.
 *
 * Priority this turn:
 *  1. Authored beat effects already applied (justHappenedSoFar)
 *  2. Director worldToPlayer.effects[] (validated allowlist) — preferred
 *  3. Legacy physical.kind / flags → default compositions
 *  4. Location on_enter hazards
 *  5. Blocked voluntary leave while seized
 */

import type {
  DirectorWorldToPlayer,
  Effect,
  JustHappened,
  MysteryDefinition,
  PlaythroughState,
  StatePatch,
} from "@mystery/shared";
import {
  applyDefaultAssaultConsequences,
  assaultCaseHandled,
} from "./assault-default.js";
import {
  applyDefaultPlayerImpact,
  applyOnEnterHazards,
  type PlayerImpactKind,
  type PlayerPushback,
} from "./player-impact.js";
import { applyDirectorWorldToPlayerEffects } from "./world-to-player-effects.js";

export type WorldToPlayerContext = {
  notes: string[];
  applied: StatePatch;
  firedBeatIds: string[];
  justHappenedSoFar: JustHappened[];
  rejected: string[];
  /**
   * Director-proposed world→player payload (effects allowlist).
   * When active + effects, this is the preferred free-text path.
   */
  worldToPlayer?: DirectorWorldToPlayer | null;
};

export type WorldToPlayerResult = {
  state: PlaythroughState;
  justHappened: JustHappened[];
};

function asPushback(v: unknown): PlayerPushback | undefined {
  const s = String(v ?? "");
  if (
    s === "none" ||
    s === "warn" ||
    s === "eject" ||
    s === "hold" ||
    s === "restrain" ||
    s === "harm"
  ) {
    return s;
  }
  return undefined;
}

/** Map free-form kind strings to default composition kinds. */
function legacyKind(raw: string): PlayerImpactKind | "assault" | null {
  const k = raw.toLowerCase().trim();
  if (!k || k === "none") return null;
  if (
    /assault|attack|fight|violence|shove|slap|hit|kick|grab|force/.test(k)
  ) {
    return "assault";
  }
  if (/hazard|fall|slip|drown|fire|ice|collapse|environment/.test(k)) {
    return "hazard";
  }
  if (/trespass|break.?in|forced.?entry/.test(k)) return "trespass";
  if (/misconduct|gross|disrupt|vandal|urine|spit/.test(k)) return "misconduct";
  if (/provoke|annoy|harass|insult|refuse|bouncer|eject|scene/.test(k)) {
    return "provoke";
  }
  // Unknown free string → treat as provoke (social/world pressure), not none
  return "provoke";
}

/**
 * Core engine step: resolve everything that happens TO the player this turn.
 */
export function resolveWorldToPlayer(
  def: MysteryDefinition,
  state: PlaythroughState,
  ctx: WorldToPlayerContext
): WorldToPlayerResult {
  let current = state;
  const justHappened: JustHappened[] = [];
  const {
    notes,
    applied,
    firedBeatIds,
    justHappenedSoFar,
    rejected,
    worldToPlayer,
  } = ctx;
  const priorJh = [...justHappenedSoFar];

  // ── 1. Blocked escape while seized ─────────────────────────────────────
  const controlBlock = rejected.find((r) =>
    /held|restrained|unconscious|on the floor|under your own power/i.test(r)
  );
  if (controlBlock && !applied.setLocationId) {
    const control = current.playerStatus?.control ?? "free";
    justHappened.push({
      id: `player_control_block_${control}`,
      summary: controlBlock,
      narrationHints: `The player tried to leave or move freely but cannot: ${controlBlock} Reflect status.control (${control}) and controlledBy if set. Stage the struggle or failed escape — do not let them walk out of the room.`,
    });
  }

  const caseHandled = assaultCaseHandled(firedBeatIds, [
    ...priorJh,
    ...justHappened,
  ]);

  // ── 2. Preferred: AI-composed effects (open situations, fixed tools) ───
  const w2p = worldToPlayer;
  const directorEffects = (w2p?.effects ?? []) as Effect[];
  const directorActive =
    Boolean(w2p?.active) || directorEffects.length > 0;

  if (directorActive && directorEffects.length > 0) {
    const r = applyDirectorWorldToPlayerEffects(def, current, {
      summary: w2p?.summary,
      effects: directorEffects,
      caseHandled,
    });
    current = r.state;
    justHappened.push(...r.justHappened);
  } else {
    // ── 3. Legacy / flag path when AI did not send effects[] ─────────────
    const assaultThisTurn = Boolean(
      notes.some(
        (n) => n.startsWith("assault→") || n.startsWith("assault_flags")
      ) ||
        applied.setFlags?.player_assaulted_staff ||
        applied.setFlags?.player_assaulted_someone
    );

    if (assaultThisTurn) {
      const targetId = String(
        applied.setFlags?.last_assault_target ??
          current.flags.last_assault_target ??
          ""
      );
      const manner = String(
        applied.setFlags?.last_assault_manner ??
          current.flags.last_assault_manner ??
          "assault"
      );
      const attempts = Number(current.flags.assault_attempts ?? 0);

      if (targetId) {
        const r = applyDefaultAssaultConsequences(def, current, {
          targetId,
          manner,
          attempts,
          caseHandled,
        });
        current = r.state;
        justHappened.push(...r.justHappened);
      }

      const targetName =
        def.characters.find((c) => c.id === targetId)?.name ??
        (targetId || "them");
      const control = current.playerStatus?.control ?? "free";
      justHappened.push({
        id: `assault_attempt_${targetId || "unknown"}`,
        summary:
          control !== "free"
            ? `You try force on ${targetName} — and lose free movement`
            : `You use force on ${targetName}`,
        narrationHints: `WORLD→PLAYER: stage real contact with ${targetName}. control=${control}.`,
      });
    }

    const worldPushThisTurn = Boolean(
      notes.some((n) =>
        /^(misconduct|provoke|trespass|hazard)→/.test(n)
      ) ||
        applied.setFlags?.player_misconduct ||
        applied.setFlags?.player_world_push
    );

    if (worldPushThisTurn && !assaultThisTurn) {
      const kindNote = notes.find((n) =>
        /^(misconduct|provoke|trespass|hazard)→/.test(n)
      );
      const flagKind = String(
        applied.setFlags?.last_world_push_kind ??
          current.flags.last_world_push_kind ??
          ""
      );
      const rawKind =
        kindNote?.split("→")[0] ??
        flagKind ??
        "provoke";
      const mapped = legacyKind(rawKind) ?? "provoke";
      const kind: PlayerImpactKind =
        mapped === "assault" ? "provoke" : mapped;

      const targetId = String(
        applied.setFlags?.world_push_target ??
          applied.setFlags?.misconduct_witness ??
          current.flags.world_push_target ??
          current.flags.misconduct_witness ??
          ""
      );

      const r = applyDefaultPlayerImpact(def, current, {
        kind,
        targetId: targetId || undefined,
        manner: String(
          applied.setFlags?.last_world_push_manner ??
            current.flags.last_world_push_manner ??
            ""
        ),
        misconductKind: String(
          applied.setFlags?.last_misconduct ??
            current.flags.last_misconduct ??
            "disrupt"
        ),
        pushback: asPushback(
          applied.setFlags?.last_pushback ?? current.flags.last_pushback
        ),
        ejectToLocationId: applied.setFlags?.eject_to_location
          ? String(applied.setFlags.eject_to_location)
          : undefined,
        hazardId: applied.setFlags?.last_hazard_id
          ? String(applied.setFlags.last_hazard_id)
          : undefined,
        condition: applied.setFlags?.hazard_condition
          ? String(applied.setFlags.hazard_condition)
          : undefined,
        tag: applied.setFlags?.hazard_tag
          ? String(applied.setFlags.hazard_tag)
          : undefined,
        caseHandled: assaultCaseHandled(firedBeatIds, [
          ...priorJh,
          ...justHappened,
        ]),
      });
      current = r.state;
      justHappened.push(...r.justHappened);
    }
  }

  // ── 4. Enter-location hazards (authored) ───────────────────────────────
  if (applied.setLocationId) {
    const loc = def.locations.find((l) => l.id === applied.setLocationId);
    justHappened.push({
      id: "moved",
      summary: `Player moved to ${loc?.name ?? applied.setLocationId}`,
      narrationHints: `You arrive at ${loc?.name ?? "a new place"}.`,
    });
    const enterHaz = applyOnEnterHazards(def, current);
    current = enterHaz.state;
    justHappened.push(...enterHaz.justHappened);
  }

  return { state: current, justHappened };
}
