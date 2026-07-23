/**
 * Formal accusation ceremony — Accuse button flow.
 *
 * 1. beginFormalAccusation: set the scene (location, gather cast, flag).
 * 2. Player speaks freeform into that scene (no form).
 * 3. applyAccuseGate treats speech in the scene as formal when an accuse
 *    intent is present; scoring and denouement follow as usual.
 *
 * The AI only performs staging/reactions; the engine owns judgment.
 */

import type {
  JustHappened,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import { knownAsFor } from "./identity.js";

export type FormalAccusationScene = {
  active: true;
  openedOnTurn: number;
  locationId?: string;
};

export type BeginFormalAccusationResult = {
  state: PlaythroughState;
  justHappened: JustHappened[];
  /** True if already in a formal scene (idempotent). */
  alreadyActive: boolean;
  rejected?: string;
};

function defaultStaging(def: MysteryDefinition) {
  return {
    locationId: undefined as string | undefined,
    gatherCharacterIds: undefined as string[] | undefined,
    narrationHints:
      def.accusePolicy?.staging?.narrationHints ??
      "A formal accusation is about to be made. Gather those who should hear the charge in this place. The player has not yet spoken their case — stage the assembly, the weight of the moment, and wait in silence for their charge. Do not invent a culprit, do not resolve anything, reveal nothing about guilt.",
    composerPlaceholder:
      def.accusePolicy?.staging?.composerPlaceholder ??
      "State your formal accusation — who, how, and why…",
    winHint:
      def.accusePolicy?.staging?.winHint ??
      "Name who is responsible, and enough of how and why for the charge to hold.",
  };
}

/** Resolved staging config for UI + engine. */
export function resolveAccuseStaging(def: MysteryDefinition) {
  const s = def.accusePolicy?.staging;
  const d = defaultStaging(def);
  return {
    locationId: s?.locationId ?? d.locationId,
    gatherCharacterIds: s?.gatherCharacterIds ?? d.gatherCharacterIds,
    narrationHints: s?.narrationHints?.trim() || d.narrationHints,
    composerPlaceholder: s?.composerPlaceholder ?? d.composerPlaceholder,
    winHint: s?.winHint ?? d.winHint,
  };
}

/**
 * Open the formal accusation ceremony. Moves player (and gathered cast)
 * when authored; emits justHappened for the performer. Does not score.
 */
export function beginFormalAccusation(
  def: MysteryDefinition,
  state: PlaythroughState
): BeginFormalAccusationResult {
  if (state.status !== "active") {
    return {
      state,
      justHappened: [],
      alreadyActive: false,
      rejected: "Case is not open for accusation.",
    };
  }
  if (state.formalAccusationScene?.active) {
    return { state, justHappened: [], alreadyActive: true };
  }

  const staging = resolveAccuseStaging(def);
  let next: PlaythroughState = { ...state };
  const justHappened: JustHappened[] = [];

  const targetLoc =
    staging.locationId &&
    def.locations.some((l) => l.id === staging.locationId)
      ? staging.locationId
      : state.locationId;

  if (targetLoc !== state.locationId) {
    next = {
      ...next,
      locationId: targetLoc,
      visitedLocationIds: next.visitedLocationIds.includes(targetLoc)
        ? next.visitedLocationIds
        : [...next.visitedLocationIds, targetLoc],
    };
  }

  // Gather available non-victim cast to the staging location.
  const gatherIds =
    staging.gatherCharacterIds && staging.gatherCharacterIds.length > 0
      ? staging.gatherCharacterIds
      : def.characters
          .filter((c) => c.storyRole !== "victim")
          .map((c) => c.id);

  const characterState = { ...next.characterState };
  const gatheredNames: string[] = [];
  for (const cid of gatherIds) {
    const cs = characterState[cid];
    const ch = def.characters.find((c) => c.id === cid);
    if (!cs?.available || !ch || ch.storyRole === "victim") continue;
    characterState[cid] = { ...cs, locationId: targetLoc };
    gatheredNames.push(knownAsFor(def, next, cid));
  }
  next = { ...next, characterState };

  const locName =
    def.locations.find((l) => l.id === targetLoc)?.name ?? targetLoc;

  next = {
    ...next,
    formalAccusationScene: {
      active: true,
      openedOnTurn: state.turnCount,
      locationId: targetLoc,
    },
    // Clear informal pending — formal scene replaces it.
    pendingAccusation: undefined,
  };

  justHappened.push({
    id: "formal_accusation_scene",
    summary: `Formal accusation in ${locName}`,
    narrationHints: [
      staging.narrationHints,
      gatheredNames.length
        ? `Those who can hear the charge include: ${gatheredNames.join(", ")}. They are present.`
        : "Stage whoever can reasonably hear a formal charge here.",
      "The player has NOT yet named a culprit or stated how/why. Do not resolve the case. Wait for their formal speech on the next turn.",
    ].join("\n"),
  });

  return { state: next, justHappened, alreadyActive: false };
}

/** Clear formal scene without scoring (cancel / withdraw). */
export function clearFormalAccusationScene(
  state: PlaythroughState
): PlaythroughState {
  if (!state.formalAccusationScene?.active) return state;
  return { ...state, formalAccusationScene: undefined };
}

export function isFormalAccusationSceneActive(
  state: PlaythroughState
): boolean {
  return state.formalAccusationScene?.active === true;
}
