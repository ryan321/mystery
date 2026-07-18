import type { FlagRequirement, FlagValue } from "@mystery/shared";

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
