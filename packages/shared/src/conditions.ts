import { z } from "zod";

/**
 * Loose condition objects; engine switches on type.
 * Avoid recursive Zod lazy (fragile across package builds).
 */
export const ConditionSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();

export type Condition = {
  type: string;
  [key: string]: unknown;
};
