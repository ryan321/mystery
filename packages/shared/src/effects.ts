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
  /** Prefer a specific authored ending id (failure branches). */
  endingId: z.string().optional(),
  /** Prefer ending by kind e.g. murdered | time_expired | arrested */
  endingKind: z.string().optional(),
  /** Alias for endingKind on end_case */
  kind: z.string().optional(),
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
  /** Player threat level: none | watched | threatened | assaulted */
  threat: z.string().optional(),
  /** move_object target location when not inventory */
  toLocationIdForObject: z.string().optional(),
  /** Allow set_player_threat to decrease threat when true */
  force: z.boolean().optional(),
  /** Relationship edge id */
  relationshipId: z.string().optional(),
  fromId: z.string().optional(),
  toId: z.string().optional(),
  strength: z.number().optional(),
  knownToPlayer: z.boolean().optional(),
  active: z.boolean().optional(),
  label: z.string().optional(),
  /** Inventory / object item id (usually evidence id). */
  itemId: z.string().optional(),
  condition: z.string().optional(),
  holder: z.string().optional(),
});

export type Effect = {
  type: string;
  [key: string]: unknown;
};
