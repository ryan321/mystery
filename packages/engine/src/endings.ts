import type {
  Ending,
  EndingKind,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import { flagsMatch } from "./flags.js";

export type EndCaseOpts = {
  outcome?: "success" | "partial" | "failure" | "custom";
  endingId?: string;
  kind?: EndingKind | string;
};

/**
 * Pick the best matching ending for a case close.
 * Priority: explicit endingId → kind (+ flags) → when/outcome (+ flags) → first ending.
 */
export function selectEnding(
  def: MysteryDefinition,
  state: PlaythroughState,
  opts: EndCaseOpts = {}
): Ending | undefined {
  if (opts.endingId) {
    const byId = def.endings.find((e) => e.id === opts.endingId);
    if (byId) return byId;
  }

  if (opts.kind) {
    const byKind = def.endings.filter((e) => e.kind === opts.kind);
    const flagMatch = byKind.find((e) =>
      flagsMatch(state.flags, e.requiresFlags)
    );
    if (flagMatch) return flagMatch;
    if (byKind[0]) return byKind[0];
  }

  const outcome = opts.outcome ?? "failure";
  const candidates = def.endings.filter((e) => e.when === outcome);
  const withFlags = candidates.find((e) =>
    flagsMatch(state.flags, e.requiresFlags)
  );
  if (withFlags) return withFlags;
  if (candidates[0]) return candidates[0];

  // Fallbacks
  if (outcome === "partial") {
    return (
      def.endings.find((e) => e.when === "success") ?? def.endings[0]
    );
  }
  return def.endings[0];
}

export function statusForOutcome(
  outcome: "success" | "partial" | "failure" | "custom"
): PlaythroughState["status"] {
  if (outcome === "failure") return "failed";
  if (outcome === "custom") return "failed";
  return "solved";
}

export function outcomeFromEnding(
  ending: Ending
): "success" | "partial" | "failure" | "custom" {
  return ending.when;
}
