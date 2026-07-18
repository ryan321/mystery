import type {
  Ending,
  MysteryDefinition,
  PlaythroughState,
  Resolution,
} from "@mystery/shared";
import { selectEnding, statusForOutcome } from "./endings.js";

export type EnterResolutionOpts = {
  outcome: "success" | "partial" | "failure" | "custom";
  endingId?: string;
  kind?: string;
  path?: string;
  forceHardEnd?: boolean;
};

export type EnterResolutionResult = {
  state: PlaythroughState;
  ending?: Ending;
  enteredDenouement: boolean;
  summary: string;
  narrationHints?: string;
};

function wrapUpEnabled(def: MysteryDefinition): boolean {
  // Default ON when omitted
  return def.wrapUp?.enabled !== false;
}

/**
 * Apply judgment: either enter interactive denouement or hard-close.
 */
export function enterResolution(
  def: MysteryDefinition,
  state: PlaythroughState,
  opts: EnterResolutionOpts
): EnterResolutionResult {
  // Already past judgment — only finalize or no-op
  if (state.status === "denouement") {
    return {
      state,
      enteredDenouement: true,
      summary: "Already in denouement",
    };
  }
  if (state.status !== "active" && !opts.forceHardEnd) {
    return {
      state,
      enteredDenouement: false,
      summary: `Case already ${state.status}`,
    };
  }

  const ending = selectEnding(def, state, {
    endingId: opts.endingId,
    kind: opts.kind,
    outcome: opts.outcome,
  });
  const outcome = ending
    ? (ending.when as EnterResolutionOpts["outcome"])
    : opts.outcome;
  const finalStatus = statusForOutcome(
    outcome === "custom" ? "failure" : outcome
  );

  const resolution: Resolution = {
    outcome,
    endingId: ending?.id,
    kind: ending?.kind ?? opts.kind,
    path: opts.path,
    title: ending?.title,
  };

  const useWrapUp = wrapUpEnabled(def) && !opts.forceHardEnd;
  const maxTurns = def.wrapUp?.maxTurns ?? 10;

  if (useWrapUp) {
    const next: PlaythroughState = {
      ...state,
      status: "denouement",
      endingId: ending?.id,
      resolution,
      denouement: {
        turnsRemaining: maxTurns,
        maxTurns,
        startedAtTurn: state.turnCount,
      },
      phaseId: "denouement",
      flags: {
        ...state.flags,
        case_solved: finalStatus === "solved",
        case_failed: finalStatus === "failed",
        in_denouement: true,
        ...(ending?.kind ? { ending_kind: ending.kind } : {}),
        ...(opts.path ? { accusation_path: opts.path } : {}),
      },
    };
    return {
      state: next,
      ending,
      enteredDenouement: true,
      summary: `Denouement: ${ending?.title ?? ending?.id ?? outcome}`,
      narrationHints: [
        ending?.templateNotes,
        def.wrapUp?.performanceNotes,
        "The case has been judged but is not over. Characters react. The player may still talk, look around, and leave. Do not reopen the investigation as unsolved.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const next: PlaythroughState = {
    ...state,
    status: finalStatus,
    endingId: ending?.id,
    resolution,
    denouement: undefined,
    flags: {
      ...state.flags,
      case_solved: finalStatus === "solved",
      case_failed: finalStatus === "failed",
      in_denouement: false,
      ...(ending?.kind ? { ending_kind: ending.kind } : {}),
      ...(opts.path ? { accusation_path: opts.path } : {}),
    },
  };
  return {
    state: next,
    ending,
    enteredDenouement: false,
    summary: `Case ${finalStatus}: ${ending?.title ?? ending?.id ?? outcome}`,
    narrationHints: ending?.templateNotes,
  };
}

/**
 * Leave denouement → permanent solved/failed.
 */
export function finalizeDenouement(
  _def: MysteryDefinition,
  state: PlaythroughState,
  reason: "turns_exhausted" | "player_exit" | "beat" | "forced" = "forced"
): PlaythroughState {
  if (state.status !== "denouement") return state;
  const outcome = state.resolution?.outcome ?? "failure";
  const finalStatus = statusForOutcome(
    outcome === "custom" ? "failure" : outcome
  );
  return {
    ...state,
    status: finalStatus,
    denouement: undefined,
    flags: {
      ...state.flags,
      in_denouement: false,
      denouement_ended: true,
      denouement_end_reason: reason,
    },
  };
}

/** True if the playthrough still accepts player turns. */
export function isInteractive(state: PlaythroughState): boolean {
  return state.status === "active" || state.status === "denouement";
}

/** Tick denouement turn budget; finalize when exhausted. */
export function tickDenouement(
  def: MysteryDefinition,
  state: PlaythroughState
): PlaythroughState {
  if (state.status !== "denouement" || !state.denouement) return state;
  const rem = state.denouement.turnsRemaining;
  if (rem === null) return state;
  const nextRem = rem - 1;
  if (nextRem <= 0) {
    return finalizeDenouement(def, {
      ...state,
      denouement: { ...state.denouement, turnsRemaining: 0 },
    }, "turns_exhausted");
  }
  return {
    ...state,
    denouement: { ...state.denouement, turnsRemaining: nextRem },
  };
}
