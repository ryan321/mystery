import { z } from "zod";

/** Loose effect objects; engine switches on type. */
export const EffectSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  value: z.union([z.boolean(), z.string(), z.number()]).optional(),
  phaseId: z.string().optional(),
  clockId: z.string().optional(),
  turns: z.number().optional(),
  beatId: z.string().optional(),
  delayTurns: z.number().optional(),
  outcome: z.enum(["success", "partial", "failure"]).optional(),
  toSlotId: z.string().optional(),
  byMinutes: z.number().optional(),
  weather: z.string().optional(),
  intensity: z.string().optional(),
  light: z.string().optional(),
  level: z.string().optional(),
  ambient: z.string().optional(),
  tag: z.string().optional(),
  characterId: z.string().optional(),
  by: z.number().optional(),
  toLocationId: z.string().optional(),
  knowledgeId: z.string().optional(),
  objectId: z.string().optional(),
  evidenceId: z.string().optional(),
  locationId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  text: z.string().optional(),
});

export type Effect = {
  type: string;
  [key: string]: unknown;
};
