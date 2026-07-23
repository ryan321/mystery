import type {
  FlagRequirement,
  FlagValue,
  MysteryDefinition,
} from "@mystery/shared";

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

/**
 * Every flag the definition itself owns: declared flags (def.flags), plus any
 * flag an inspectable reveal or a beat effect sets. These are authored
 * story-progress state — each flips only through its authored trigger (the
 * player inspects the thing, a beat fires). LLM-proposed writes must not touch
 * them: a director that sets `lantern_found` because the player *mentioned*
 * digging desyncs the world from what the player has actually done, and can
 * skip a gate or spoil a reveal. The director's job is to emit the intent that
 * fires the reveal, never to set its outcome flag. Cheap to recompute per turn;
 * the definition is small.
 */
export function authoredFlagKeys(def: MysteryDefinition): Set<string> {
  const keys = new Set<string>();
  for (const f of def.flags ?? []) keys.add(f.id);
  for (const loc of def.locations ?? []) {
    for (const insp of loc.inspectables ?? []) {
      const sets = insp.onInspect?.setsFlags;
      if (sets) for (const k of Object.keys(sets)) keys.add(k);
    }
  }
  for (const beat of def.beats ?? []) {
    for (const eff of beat.effects ?? []) {
      if (
        (eff.type === "set_game_flag" || eff.type === "set_game_flag_true") &&
        eff.id != null
      ) {
        keys.add(String(eff.id));
      }
    }
  }
  return keys;
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
