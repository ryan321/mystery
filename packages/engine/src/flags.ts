import type { FlagRequirement, FlagValue } from "@mystery/shared";

/**
 * Flags the engine owns exclusively. They gate the sealed solution
 * (`knowledge.ts` unlocks the confession once `case_solved` is true) and the
 * case's terminal status. Only `resolve-case.ts` may write them. LLM-proposed
 * writes — the director's `suggestedPatch.setFlags` and the `set_game_flag`
 * world→player effect — must never set these, or a prompt injection that flips
 * `case_solved` makes the performer narrate the solution.
 */
export const RESERVED_FLAGS = new Set(["case_solved", "case_failed"]);

/** Drop reserved (engine-owned) keys from an untrusted flag record. */
export function stripReservedFlags(
  flags: Record<string, FlagValue>
): { flags: Record<string, FlagValue>; dropped: string[] } {
  const out: Record<string, FlagValue> = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(flags)) {
    if (RESERVED_FLAGS.has(key)) dropped.push(key);
    else out[key] = value;
  }
  return { flags: out, dropped };
}

/** Returns true if every required flag key matches the current value. */
export function flagsMatch(
  current: Record<string, FlagValue>,
  required?: FlagRequirement
): boolean {
  if (!required) return true;
  for (const [key, expected] of Object.entries(required)) {
    if (current[key] !== expected) return false;
  }
  return true;
}

export function mergeFlags(
  current: Record<string, FlagValue>,
  patch?: Record<string, FlagValue>
): Record<string, FlagValue> {
  if (!patch) return { ...current };
  return { ...current, ...patch };
}
