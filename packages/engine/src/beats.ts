import type {
  JustHappened,
  MysteryDefinition,
  PlaythroughState,
  StoryBeat,
} from "@mystery/shared";
import { evaluateCondition } from "./conditions.js";
import { applyEffects } from "./effects.js";

export type BeatEventContext = {
  /**
   * Where this evaluation sits in the turn loop.
   * - tick: after passive time/clock march (no player action yet)
   * - player: after patch applied
   * - any: tests / unconstrained
   */
  source?: "tick" | "player" | "any";
  /** Evidence ids gained this turn (player patch). */
  discoveredEvidenceIds?: string[];
  /** Presentations this turn. */
  presented?: { evidenceId: string; characterId: string }[];
  /** Primary talk target this turn. */
  talkedToCharacterId?: string;
  /** Phases entered during this evaluation cascade (filled by engine). */
  enteredPhaseIds?: string[];
};

export type BeatEvalResult = {
  state: PlaythroughState;
  justHappened: JustHappened[];
  fired: string[];
};

function triggerAllows(
  beat: StoryBeat,
  ctx: BeatEventContext,
  state: PlaythroughState
): boolean {
  const source = ctx.source ?? "any";
  const trigger = beat.trigger ?? "on_turn";

  // Manual only via queue
  if (trigger === "manual") {
    return state.beatQueue.some(
      (q) => q.beatId === beat.id && q.fireOnTurn <= state.turnCount
    );
  }

  // On tick: only time/clock world reactions — not discover/present/talk
  if (source === "tick") {
    if (
      trigger === "on_discover" ||
      trigger === "on_present" ||
      trigger === "on_talk"
    ) {
      return false;
    }
    // on_turn and on_phase_enter allowed on tick (phase enter rare on tick)
  }

  // Unconstrained (unit tests / tools): only `when` matters
  if (source === "any") return true;

  switch (trigger) {
    case "on_turn":
      return true;
    case "on_discover":
      return (ctx.discoveredEvidenceIds?.length ?? 0) > 0;
    case "on_present":
      return (ctx.presented?.length ?? 0) > 0;
    case "on_talk":
      return Boolean(ctx.talkedToCharacterId);
    case "on_phase_enter": {
      const entered = ctx.enteredPhaseIds ?? [];
      return entered.includes(state.phaseId);
    }
    default:
      return true;
  }
}

function beatEligible(
  def: MysteryDefinition,
  state: PlaythroughState,
  beat: StoryBeat,
  ctx: BeatEventContext
): boolean {
  if (beat.once && state.firedBeatIds.includes(beat.id)) return false;

  if (beat.trigger === "manual") {
    return state.beatQueue.some(
      (q) => q.beatId === beat.id && q.fireOnTurn <= state.turnCount
    );
  }

  // Queued beats: must be due
  const queued = state.beatQueue.find((q) => q.beatId === beat.id);
  if (queued && queued.fireOnTurn > state.turnCount) return false;

  if (!triggerAllows(beat, ctx, state)) return false;

  return evaluateCondition(def, state, beat.when);
}

/**
 * Evaluate story beats in bounded cascades (maxPasses).
 * Pass event context so triggers (discover/present/talk/tick) are honored.
 */
export function evaluateBeats(
  def: MysteryDefinition,
  state: PlaythroughState,
  maxPasses = 3,
  eventContext: BeatEventContext = { source: "any" }
): BeatEvalResult {
  let current = state;
  const allHappened: JustHappened[] = [];
  const fired: string[] = [];
  const enteredPhaseIds = new Set<string>(eventContext.enteredPhaseIds ?? []);
  let prevPhase = state.phaseId;

  const ctx = (): BeatEventContext => ({
    ...eventContext,
    enteredPhaseIds: [...enteredPhaseIds],
  });

  for (let pass = 0; pass < maxPasses; pass++) {
    if (current.status !== "active" && current.status !== "denouement") {
      break;
    }

    let firedThisPass = false;
    for (const beat of def.beats) {
      if (current.status !== "active" && current.status !== "denouement") {
        break;
      }
      if (!beatEligible(def, current, beat, ctx())) continue;

      current = {
        ...current,
        firedBeatIds: [...current.firedBeatIds, beat.id],
        beatQueue: current.beatQueue.filter((q) => q.beatId !== beat.id),
      };
      fired.push(beat.id);
      firedThisPass = true;

      const effectResult = applyEffects(def, current, beat.effects);
      current = effectResult.state;

      if (current.phaseId !== prevPhase) {
        enteredPhaseIds.add(current.phaseId);
        prevPhase = current.phaseId;
      }

      allHappened.push({
        id: beat.id,
        summary: beat.title ?? beat.id,
        narrationHints: beat.narrationHints,
      });
      allHappened.push(...effectResult.justHappened);

      for (const r of beat.reactions ?? []) {
        if (r.stance) {
          const cs = current.characterState[r.characterId];
          if (cs) {
            current = {
              ...current,
              characterState: {
                ...current.characterState,
                [r.characterId]: { ...cs, stance: r.stance },
              },
            };
          }
        }
        if (r.lineHint) {
          allHappened.push({
            id: `${beat.id}_rx_${r.characterId}`,
            summary: `Reaction ${r.characterId}`,
            narrationHints: r.lineHint,
          });
        }
      }
    }
    if (!firedThisPass) break;
  }

  return { state: current, justHappened: allHappened, fired };
}

/** Passive story-time march at start of turn. */
export function advancePassiveTime(
  def: MysteryDefinition,
  state: PlaythroughState
): PlaythroughState {
  // Always clear one-shot pulses and per-turn time edge marks when no time config
  if (!def.time || !state.time || def.time.minutesPerTurn <= 0) {
    // Still tick countdown clocks even without story-time march
    const clocks: Record<string, number> = {};
    for (const [k, v] of Object.entries(state.clocks)) {
      clocks[k] = Math.max(0, v - 1);
    }
    return {
      ...state,
      clocks: Object.keys(clocks).length ? clocks : state.clocks,
      time: state.time
        ? { ...state.time, reachedSlotIdsThisTurn: [] }
        : state.time,
      environment: {
        ...state.environment,
        activePulses: [],
      },
    };
  }

  const minutes = state.time.minutesFromStart + def.time.minutesPerTurn;
  const schedule = [...def.time.schedule].sort(
    (a, b) => a.minutesFromStart - b.minutesFromStart
  );
  let slot = schedule[0]!;
  for (const s of schedule) {
    if (minutes >= s.minutesFromStart) slot = s;
  }
  const reached: string[] = [];
  if (slot.id !== state.time.slotId) reached.push(slot.id);

  const clocks: Record<string, number> = {};
  for (const [k, v] of Object.entries(state.clocks)) {
    clocks[k] = Math.max(0, v - 1);
  }

  return {
    ...state,
    clocks,
    time: {
      slotId: slot.id,
      minutesFromStart: minutes,
      reachedSlotIdsThisTurn: reached,
    },
    environment: {
      ...state.environment,
      activePulses: [],
    },
  };
}
