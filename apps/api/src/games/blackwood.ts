/**
 * Example owned game module: case-specific voice + dawn pacing via hooks.
 * Does NOT fork the turn loop — composes `standardTurn` so platform bugfixes
 * apply here automatically. Pattern for every future high-quality case.
 */
import type { JustHappened } from "@mystery/shared";
import { standardTurn } from "./standard-turn.js";
import type { GameModule, Platform, TurnRequest, TurnResult } from "./types.js";

export const BLACKWOOD_ID = "blackwood-inheritance";

/** Voice: keep hold/summon policy and gothic tone out of shared engine. */
const GUIDANCE = {
  director:
    "Blackwood is a rain-soaked country-house night. Suspects are grieving, " +
    "guarded, and proud — they resist with cold refusal and social pressure, " +
    "never by physically restraining a police inspector over a conversation. " +
    "Reserve hold_player/restrain for a genuine, capable threat. " +
    "The Inspector holds his ground: servants and suspects are sent for or " +
    "come to him — he is not marched from room to room because he named or " +
    "called for someone. Only move him when he says he is going somewhere, or " +
    "is plainly escorted. A butler or maid may answer a summons and come to " +
    "him; a guarded suspect need not.",
  performer:
    "Tone: gothic and candle-lit, the storm against the glass; dry, literate, " +
    "never lurid. Keep NPC replies clipped and class-conscious. The night runs " +
    "toward dawn — let the passage of time press quietly on the scene.",
};

/** Edge-triggered pre-dawn pressure (once per slot enter). */
const PRE_DAWN_SLOTS: Record<string, string> = {
  small_hours:
    "It is the small hours now — the house has gone very still, and the night " +
    "is more than half spent. Let a note of tiredness and urgency in.",
  toward_dawn:
    "The dark is thinning toward dawn; the storm is easing. Time is nearly out. " +
    "Let the coming light press hard — this is the last of the night.",
};

function dawnPressureJustHappened(
  state: TurnRequest["state"]
): JustHappened | null {
  if (state.status !== "active") return null;
  const dawnSlot = (state.time?.reachedSlotIdsThisTurn ?? []).find(
    (s) => PRE_DAWN_SLOTS[s]
  );
  if (!dawnSlot) return null;
  return {
    id: "dawn_pressure",
    summary: "The night presses toward dawn",
    narrationHints: PRE_DAWN_SLOTS[dawnSlot],
  };
}

export const blackwoodGame: GameModule = {
  id: BLACKWOOD_ID,

  runTurn(req: TurnRequest, platform: Platform): Promise<TurnResult> {
    return standardTurn(req, platform, {
      guidance: GUIDANCE,
      afterTick: ({ state }) => {
        const jh = dawnPressureJustHappened(state);
        return jh ? { justHappened: [jh] } : undefined;
      },
    });
  },
};
