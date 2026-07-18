import { z } from "zod";
import { FlagValueSchema } from "./definition.js";

export const PlaythroughStatusSchema = z.enum([
  "active",
  "solved",
  "failed",
  "abandoned",
]);
export type PlaythroughStatus = z.infer<typeof PlaythroughStatusSchema>;

export const NotebookEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.enum(["auto", "player"]),
  createdAt: z.string(),
});
export type NotebookEntry = z.infer<typeof NotebookEntrySchema>;

export const DialogueTurnSchema = z.object({
  role: z.enum(["player", "character", "narration"]),
  text: z.string(),
  at: z.string(),
});
export type DialogueTurn = z.infer<typeof DialogueTurnSchema>;

export const CharacterMemorySchema = z.object({
  revealedBeatIds: z.array(z.string()).default([]),
  summary: z.string().default(""),
  recentTurns: z.array(DialogueTurnSchema).default([]),
});
export type CharacterMemory = z.infer<typeof CharacterMemorySchema>;

export const PlaythroughStateSchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  contentVersion: z.string().min(1),
  status: PlaythroughStatusSchema,
  locationId: z.string().min(1),
  evidenceIds: z.array(z.string()).default([]),
  flags: z.record(FlagValueSchema).default({}),
  notebook: z.array(NotebookEntrySchema).default([]),
  characterMemory: z.record(CharacterMemorySchema).default({}),
  visitedLocationIds: z.array(z.string()).default([]),
  turnCount: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlaythroughState = z.infer<typeof PlaythroughStateSchema>;

/** LLM proposes; engine validates before apply. */
export const StatePatchSchema = z.object({
  setLocationId: z.string().optional(),
  addEvidenceIds: z.array(z.string()).optional(),
  setFlags: z.record(FlagValueSchema).optional(),
  revealBeats: z
    .array(
      z.object({
        characterId: z.string(),
        beatId: z.string(),
      })
    )
    .optional(),
  notebookAppend: z.array(z.string()).optional(),
  accuse: z
    .object({
      summary: z.string(),
      suspectIds: z.array(z.string()).optional(),
      method: z.string().optional(),
      motive: z.string().optional(),
    })
    .optional(),
});
export type StatePatch = z.infer<typeof StatePatchSchema>;

export const TurnModelOutputSchema = z.object({
  narration: z.string().min(1),
  dialogue: z
    .array(
      z.object({
        characterId: z.string(),
        characterName: z.string(),
        text: z.string(),
      })
    )
    .optional(),
  patch: StatePatchSchema.default({}),
  intentGuess: z.string().optional(),
});
export type TurnModelOutput = z.infer<typeof TurnModelOutputSchema>;

export const TurnResultSchema = z.object({
  narration: z.string(),
  dialogue: z
    .array(
      z.object({
        characterId: z.string(),
        characterName: z.string(),
        text: z.string(),
      })
    )
    .default([]),
  state: PlaythroughStateSchema,
  appliedPatch: StatePatchSchema,
  rejected: z.array(z.string()).default([]),
  evidenceAdded: z.array(z.string()).default([]),
});
export type TurnResult = z.infer<typeof TurnResultSchema>;
