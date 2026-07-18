import { z } from "zod";
import { FlagValueSchema } from "./definition.js";

export const PlaythroughStatusSchema = z.enum([
  "active",
  "solved",
  "failed",
  "abandoned",
]);
export type PlaythroughStatus = z.infer<typeof PlaythroughStatusSchema>;

export const WillingnessSchema = z.enum([
  "open",
  "guarded",
  "hostile",
  "silent",
  "fled",
]);
export type Willingness = z.infer<typeof WillingnessSchema>;

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

export const CharacterRuntimeStateSchema = z.object({
  locationId: z.string(),
  available: z.boolean().default(true),
  willingness: WillingnessSchema.default("open"),
  pressure: z.number().default(0),
  stance: z.string().default(""),
  alibiStatus: z
    .enum(["claimed", "broken", "abandoned", "none"])
    .default("none"),
  timesTalked: z.number().int().nonnegative().default(0),
});
export type CharacterRuntimeState = z.infer<typeof CharacterRuntimeStateSchema>;

export const ObjectRuntimeStateSchema = z.object({
  stage: z
    .enum([
      "hidden",
      "visible",
      "examined",
      "taken",
      "destroyed",
      "given_away",
    ])
    .default("visible"),
  locked: z.boolean().default(false),
  locationId: z.string().optional(),
});
export type ObjectRuntimeState = z.infer<typeof ObjectRuntimeStateSchema>;

export const LocationRuntimeStateSchema = z.object({
  accessible: z.boolean().default(true),
  descriptionAppend: z.string().default(""),
  /** key `${from}->${to}` → open */
  exitOpen: z.record(z.boolean()).default({}),
});
export type LocationRuntimeState = z.infer<typeof LocationRuntimeStateSchema>;

export const EnvironmentStateSchema = z.object({
  weather: z.string().default("clear"),
  weatherIntensity: z.string().optional(),
  light: z.string().default("day"),
  ambient: z.string().optional(),
  crowd: z.string().default("none"),
  flags: z.record(FlagValueSchema).default({}),
  activePulses: z.array(z.string()).default([]),
});
export type EnvironmentState = z.infer<typeof EnvironmentStateSchema>;

export const TimeStateSchema = z.object({
  slotId: z.string(),
  minutesFromStart: z.number().nonnegative().default(0),
  /** Slots entered this turn (for time_reached). */
  reachedSlotIdsThisTurn: z.array(z.string()).default([]),
});
export type TimeState = z.infer<typeof TimeStateSchema>;

export const PresentedRecordSchema = z.object({
  evidenceId: z.string(),
  characterId: z.string(),
  turn: z.number().int(),
});
export type PresentedRecord = z.infer<typeof PresentedRecordSchema>;

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
  // Dynamics
  phaseId: z.string().default("arrival"),
  firedBeatIds: z.array(z.string()).default([]),
  beatQueue: z
    .array(
      z.object({
        beatId: z.string(),
        fireOnTurn: z.number().int(),
      })
    )
    .default([]),
  clocks: z.record(z.number()).default({}),
  characterState: z.record(CharacterRuntimeStateSchema).default({}),
  objectState: z.record(ObjectRuntimeStateSchema).default({}),
  locationState: z.record(LocationRuntimeStateSchema).default({}),
  environment: EnvironmentStateSchema.default({
    weather: "clear",
    light: "day",
    crowd: "none",
    flags: {},
    activePulses: [],
  }),
  time: TimeStateSchema.optional(),
  presented: z.array(PresentedRecordSchema).default([]),
  endingId: z.string().optional(),
});
export type PlaythroughState = z.infer<typeof PlaythroughStateSchema>;

/** LLM / director proposes; engine validates before apply. */
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
  presented: z
    .array(
      z.object({
        evidenceId: z.string(),
        characterId: z.string(),
      })
    )
    .optional(),
  talkToCharacterId: z.string().optional(),
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
