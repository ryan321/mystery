import { z } from "zod";
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
  z.object({
    type: z.literal("other"),
    note: z.string().optional(),
  }),
]);
export type DirectorIntent = z.infer<typeof DirectorIntentSchema>;

export const DirectorOutputSchema = z.object({
  intents: z.array(DirectorIntentSchema).min(1),
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
