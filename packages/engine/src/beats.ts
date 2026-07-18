import type {
  JustHappened,
  MysteryDefinition,
  PlaythroughState,
  StoryBeat,
} from "@mystery/shared";
import { evaluateCondition } from "./conditions.js";
import { applyEffects } from "./effects.js";

export type BeatEvalResult = {
  state: PlaythroughState;
  justHappened: JustHappened[];
  fired: string[];
};

function beatEligible(
  def: MysteryDefinition,
  state: PlaythroughState,
  beat: StoryBeat
): boolean {
  if (beat.once && state.firedBeatIds.includes(beat.id)) return false;
  if (beat.trigger === "manual") {
    // only via queue with fireOnTurn
    return state.beatQueue.some(
      (q) => q.beatId === beat.id && q.fireOnTurn <= state.turnCount
    );
  }
  // queued beats also fire when due
  const queued = state.beatQueue.find((q) => q.beatId === beat.id);
  if (queued && queued.fireOnTurn > state.turnCount) return false;

  return evaluateCondition(def, state, beat.when);
}

/**
 * Evaluate story beats in bounded cascades (maxPasses).
 */
export function evaluateBeats(
  def: MysteryDefinition,
  state: PlaythroughState,
  maxPasses = 3
): BeatEvalResult {
  let current = state;
  const allHappened: JustHappened[] = [];
  const fired: string[] = [];

  for (let pass = 0; pass < maxPasses; pass++) {
    let firedThisPass = false;
    for (const beat of def.beats) {
      if (!beatEligible(def, current, beat)) continue;

      // mark fired first to prevent re-entry
      current = {
        ...current,
        firedBeatIds: [...current.firedBeatIds, beat.id],
        beatQueue: current.beatQueue.filter((q) => q.beatId !== beat.id),
      };
      fired.push(beat.id);
      firedThisPass = true;

      const effectResult = applyEffects(def, current, beat.effects);
      current = effectResult.state;

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
  if (!def.time || !state.time || def.time.minutesPerTurn <= 0) {
    return {
      ...state,
      time: state.time
        ? { ...state.time, reachedSlotIdsThisTurn: [] }
        : state.time,
      environment: {
        ...state.environment,
        activePulses: [],
      },
    };
  }

  const minutes =
    state.time.minutesFromStart + def.time.minutesPerTurn;
  const schedule = [...def.time.schedule].sort(
    (a, b) => a.minutesFromStart - b.minutesFromStart
  );
  let slot = schedule[0]!;
  for (const s of schedule) {
    if (minutes >= s.minutesFromStart) slot = s;
  }
  const reached: string[] = [];
  if (slot.id !== state.time.slotId) reached.push(slot.id);

  // tick countdown clocks
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
