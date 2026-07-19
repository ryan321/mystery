import { z } from "zod";
import { EffectSchema } from "./effects.js";
import { StatePatchSchema } from "./playthrough.js";

/** Call #1 — Director: interpret free text into structured intents (no prose authority). */
export const DirectorIntentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move"),
    toLocationId: z.string().optional(),
    exitHint: z.string().optional(),
  }),
  z.object({
    type: z.literal("inspect"),
    inspectableId: z.string().optional(),
    targetHint: z.string().optional(),
  }),
  z.object({
    type: z.literal("talk"),
    characterId: z.string().optional(),
    characterHint: z.string().optional(),
  }),
  z.object({
    type: z.literal("present"),
    evidenceId: z.string().optional(),
    characterId: z.string().optional(),
    evidenceHint: z.string().optional(),
    characterHint: z.string().optional(),
  }),
  z.object({
    type: z.literal("use"),
    evidenceId: z.string().optional(),
    targetHint: z.string().optional(),
  }),
  z.object({
    type: z.literal("look"),
  }),
  z.object({
    type: z.literal("inventory"),
  }),
  z.object({
    type: z.literal("accuse"),
    summary: z.string().optional(),
    suspectIds: z.array(z.string()).optional(),
    method: z.string().optional(),
    motive: z.string().optional(),
  }),
  /**
   * Physical aggression toward a person (shove, grab, strike).
   * Engine sets assault flags; cases author retaliation beats.
   * Not a free "win the fight" — definition decides outcome.
   */
  z.object({
    type: z.literal("assault"),
    characterId: z.string().optional(),
    characterHint: z.string().optional(),
    /** shove | push | hit | grab | knock_down | … */
    manner: z.string().optional(),
  }),
  z.object({
    type: z.literal("other"),
    note: z.string().optional(),
  }),
]);
export type DirectorIntent = z.infer<typeof DirectorIntentSchema>;

/**
 * @deprecated Prefer worldToPlayer.effects — kept so older models still work.
 * Open-ended free text; engine maps loosely when effects[] is empty.
 */
export const DirectorPhysicalSchema = z.object({
  kind: z.string().default("none"),
  characterId: z.string().optional(),
  characterHint: z.string().optional(),
  manner: z.string().optional(),
  misconductKind: z.string().optional(),
  pushback: z.string().optional(),
  ejectToLocationId: z.string().optional(),
  hazardId: z.string().optional(),
});
export type DirectorPhysical = z.infer<typeof DirectorPhysicalSchema>;

/**
 * Core: the world acts on the player this turn.
 * AI proposes engine effects (from the allowlist); engine validates & applies.
 * Do NOT enumerate every story situation — compose effects as needed.
 */
export const DirectorWorldToPlayerSchema = z.object({
  /** True when something should happen TO the player this turn. */
  active: z.boolean().default(false),
  /** Short player-facing summary e.g. "Thrown out by the bouncer" */
  summary: z.string().optional(),
  /**
   * Engine effects to apply (validated allowlist in resolve-world-to-player).
   * Examples: harm_player, hold_player, move_player, set_player_threat,
   * steal_from_player, add_player_tag, set_willingness, move_character, …
   */
  effects: z.array(EffectSchema).default([]),
});
export type DirectorWorldToPlayer = z.infer<typeof DirectorWorldToPlayerSchema>;

export const DirectorOutputSchema = z.object({
  intents: z.array(DirectorIntentSchema).min(1),
  /**
   * Preferred: free-form world→player effects. Engine owns application.
   * When active + effects[], that is authoritative for free-text pressure.
   */
  worldToPlayer: DirectorWorldToPlayerSchema.default({
    active: false,
    effects: [],
  }),
  /**
   * @deprecated Soft hint when worldToPlayer.effects is empty.
   * kind is free string (assault, hazard, provoke, …) — not a closed enum.
   */
  physical: DirectorPhysicalSchema.default({ kind: "none" }),
  /** Optional soft suggestions; engine still validates. */
  suggestedPatch: StatePatchSchema.optional(),
  focusCharacterId: z.string().optional(),
  reasoning: z.string().optional(),
});
export type DirectorOutput = z.infer<typeof DirectorOutputSchema>;

/** Call #2 — Performer: presentation only. Must not mutate game rules. */
export const PerformerOutputSchema = z.object({
  narration: z.string().min(1),
  dialogue: z
    .array(
      z.object({
        characterId: z.string(),
        characterName: z.string(),
        text: z.string(),
      })
    )
    .default([]),
});
export type PerformerOutput = z.infer<typeof PerformerOutputSchema>;

export const JustHappenedSchema = z.object({
  id: z.string(),
  summary: z.string(),
  narrationHints: z.string().optional(),
});
export type JustHappened = z.infer<typeof JustHappenedSchema>;
