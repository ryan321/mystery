import { z } from "zod";
import { EffectSchema } from "./effects.js";

export const StoryBeatSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  once: z.boolean().default(true),
  trigger: z
    .enum([
      "on_turn",
      "on_discover",
      "on_present",
      "on_talk",
      "on_phase_enter",
      "manual",
    ])
    .default("on_turn"),
  // Loose condition; engine evaluates
  when: z.object({ type: z.string() }).passthrough(),
  effects: z.array(EffectSchema).default([]),
  narrationHints: z.string().optional(),
  reactions: z
    .array(
      z.object({
        characterId: z.string(),
        lineHint: z.string().optional(),
        stance: z.string().optional(),
      })
    )
    .default([]),
});
export type StoryBeat = z.infer<typeof StoryBeatSchema>;

export const TimeSlotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  minutesFromStart: z.number().nonnegative(),
});
export type TimeSlot = z.infer<typeof TimeSlotSchema>;

export const TimeConfigSchema = z.object({
  startSlotId: z.string(),
  minutesPerTurn: z.number().nonnegative().default(0),
  schedule: z.array(TimeSlotSchema).min(1),
});
export type TimeConfig = z.infer<typeof TimeConfigSchema>;

export const EnvironmentDefaultsSchema = z.object({
  weather: z.string().default("clear"),
  weatherIntensity: z.string().optional(),
  light: z.string().default("day"),
  ambient: z.string().optional(),
  crowd: z.string().default("none"),
  flags: z.record(z.union([z.boolean(), z.string(), z.number()])).default({}),
});
export type EnvironmentDefaults = z.infer<typeof EnvironmentDefaultsSchema>;
