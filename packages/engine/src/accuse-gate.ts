import type {
  JustHappened,
  MysteryDefinition,
  PendingAccusation,
  PlaythroughState,
  StatePatch,
} from "@mystery/shared";
import { accusedCharacterIds } from "./accusation.js";
import { mergeFlags } from "./flags.js";
import { knownAsFor } from "./identity.js";
import {
  clearFormalAccusationScene,
  isFormalAccusationSceneActive,
} from "./formal-accusation.js";

/**
 * Explicitly formal wording — judged immediately, no confirmation turn.
 * "I accuse Vale", "arrest him", "that's my final answer".
 */
const FORMAL_RE =
  /\b(i (?:hereby )?(?:formally |officially )?accuse|i charge|under arrest|arrest (?:him|her|them)|my final (?:answer|accusation)|i(?:'m| am) ready to name)\b/i;

/** Confirmation of a pending accusation. */
const CONFIRM_RE =
  /\b(yes|confirm(?:ed)?|i(?:'m| am) (?:sure|certain|positive)|i stand by (?:it|that|him|her|my accusation)|do it|make it official|so be it|that(?:'s| is) my (?:accusation|answer|final answer)|i(?:'m| am) ready|formally)\b/i;

/** Stepping back from a pending accusation. */
const WITHDRAW_RE =
  /\b(never ?mind|not (?:yet|sure|ready)|withdraw|take (?:it|that) back|hold (?:on|off)|forget (?:it|that)|let me think)\b/i;

export type AccuseGateResult = {
  patch: StatePatch;
  state: PlaythroughState;
  justHappened: JustHappened[];
  notes: string[];
};

function suspectNames(
  def: MysteryDefinition,
  state: PlaythroughState,
  ids: string[]
): string[] {
  // Use the player's current labels — never leak an unrevealed real name.
  return ids.map((id) => knownAsFor(def, state, id));
}

function withAccusedFlags(
  state: PlaythroughState,
  suspectIds: string[]
): PlaythroughState {
  if (!suspectIds.length) return state;
  const flags: Record<string, boolean> = {};
  for (const id of suspectIds) flags[`accused_${id}`] = true;
  return { ...state, flags: mergeFlags(state.flags, flags) };
}

/**
 * Accusation confirmation gate. Runs BEFORE validateAndApplyPatch.
 *
 * - Informal accusations ("Vale did it") become `pendingAccusation`; the
 *   performer asks in-fiction for formal commitment. Nothing is judged.
 * - Formal wording (FORMAL_RE) or confirming/repeating while one is pending
 *   lets the accusation through to scoring.
 * - Withdrawal or expiry (accusePolicy.pendingTurns, default 3) clears it.
 * - Sets `accused_<characterId>` flags as soon as someone is named, so cases
 *   can react to being suspected even before formal judgment.
 */
export function applyAccuseGate(
  def: MysteryDefinition,
  state: PlaythroughState,
  patch: StatePatch,
  playerInput: string
): AccuseGateResult {
  const notes: string[] = [];
  const justHappened: JustHappened[] = [];

  if (state.status !== "active") {
    return { patch, state, justHappened, notes };
  }

  const requireConfirmation = def.accusePolicy?.requireConfirmation !== false;
  const pendingTurns = def.accusePolicy?.pendingTurns ?? 3;

  // Expire stale pending silently
  let next = state;
  let pending: PendingAccusation | undefined = state.pendingAccusation;
  if (pending && pending.expiresAfterTurn < state.turnCount) {
    next = { ...next, pendingAccusation: undefined };
    pending = undefined;
    notes.push("pending accusation expired");
  }

  if (!requireConfirmation) {
    return { patch, state: next, justHappened, notes };
  }

  // Accuse-button ceremony: once the household is assembled, any voiced
  // accusation is formal — the player is speaking into a staged charge, not
  // muttering a theory into the air.
  const inFormalScene = isFormalAccusationSceneActive(next);

  if (patch.accuse) {
    const formal = FORMAL_RE.test(playerInput) || inFormalScene;
    const namedIds = accusedCharacterIds(def, patch.accuse);
    // Re-voicing counts as confirmation only for the same theory; naming a
    // different suspect replaces the pending accusation instead.
    const reaffirmsPending =
      pending !== undefined &&
      (namedIds.length === 0 ||
        namedIds.some((id) => pending!.suspectIds.includes(id)));
    if (reaffirmsPending || formal) {
      // Confirmed (formal wording, ceremony scene, or reaffirming while pending).
      const merged = pending
        ? {
            summary: patch.accuse.summary || pending.summary,
            suspectIds: patch.accuse.suspectIds?.length
              ? patch.accuse.suspectIds
              : pending.suspectIds,
            method: patch.accuse.method ?? pending.method,
            motive: patch.accuse.motive ?? pending.motive,
          }
        : patch.accuse;
      next = {
        ...clearFormalAccusationScene(next),
        pendingAccusation: undefined,
      };
      notes.push(
        inFormalScene
          ? "accuse formal (ceremony scene)"
          : formal
            ? "accuse formal"
            : "accuse confirmed"
      );
      return {
        patch: { ...patch, accuse: merged },
        state: next,
        justHappened,
        notes,
      };
    }

    // Informal: park it (replacing any differing pending) and ask for commitment.
    const suspectIds = namedIds;
    // Reflect what the player's own case leaves unsaid — never a
    // comparison against the truth, so it is safe to voice in-fiction.
    const missing: ("method" | "motive")[] = [];
    if (!patch.accuse.method?.trim()) missing.push("method");
    if (!patch.accuse.motive?.trim()) missing.push("motive");
    next = withAccusedFlags(
      {
        ...next,
        pendingAccusation: {
          summary: patch.accuse.summary,
          suspectIds,
          method: patch.accuse.method,
          motive: patch.accuse.motive,
          missing,
          madeOnTurn: state.turnCount,
          expiresAfterTurn: state.turnCount + pendingTurns,
        },
      },
      suspectIds
    );
    const names = suspectNames(def, next, suspectIds);
    const gapText = missing.length
      ? ` Their stated case is silent on ${missing
          .map((m) => (m === "method" ? "HOW it was done" : "WHY"))
          .join(" and ")} — have a character (or their own doubt) press on exactly that gap, without implying whether the theory is right.`
      : "";
    justHappened.push({
      id: "accusation_pending",
      summary: `Accusation pending confirmation${names.length ? `: ${names.join(", ")}` : ""}`,
      narrationHints: `The player has voiced a theory naming ${names.join(", ") || "a suspect"}. Judgment has NOT happened. In-fiction, make the weight of a formal accusation felt and ask whether they commit to it — committing decides the case. Do not confirm or deny the theory, reveal nothing, keep the scene interactive.${gapText}`,
    });
    notes.push("accuse pending confirmation");
    const { accuse: _gated, ...rest } = patch;
    return { patch: rest, state: next, justHappened, notes };
  }

  if (pending) {
    const withdraws = WITHDRAW_RE.test(playerInput);
    const confirms = !withdraws && CONFIRM_RE.test(playerInput);
    if (confirms) {
      next = {
        ...clearFormalAccusationScene(next),
        pendingAccusation: undefined,
      };
      notes.push("accuse confirmed (pending)");
      return {
        patch: {
          ...patch,
          accuse: {
            summary: pending.summary,
            suspectIds: pending.suspectIds,
            method: pending.method,
            motive: pending.motive,
          },
        },
        state: next,
        justHappened,
        notes,
      };
    }
    if (withdraws) {
      next = {
        ...clearFormalAccusationScene(next),
        pendingAccusation: undefined,
      };
      justHappened.push({
        id: "accusation_withdrawn",
        summary: "Accusation withdrawn",
        narrationHints:
          "The player steps back from the accusation. No judgment was made; the investigation simply continues.",
      });
      notes.push("accuse withdrawn");
    }
    // Otherwise the pending accusation quietly persists until expiry.
  }

  // Cancel ceremony without a pending theory ("never mind" in the hall).
  if (inFormalScene && WITHDRAW_RE.test(playerInput) && !patch.accuse) {
    next = clearFormalAccusationScene(next);
    justHappened.push({
      id: "formal_accusation_cancelled",
      summary: "Formal accusation cancelled",
      narrationHints:
        "The player steps back; the gathering dissolves. No judgment was made. Return the scene to investigation.",
    });
    notes.push("formal accusation scene cancelled");
  }

  return { patch, state: next, justHappened, notes };
}
