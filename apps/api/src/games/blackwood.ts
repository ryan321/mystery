/**
 * Blackwood Inheritance — the first mystery to own its game module.
 *
 * v1 composes the shared engine + LLM pipeline (as libraries) so behavior is
 * unchanged. But this is Blackwood's own turn entry point: anything specialized
 * here — its director/narrator prompts, movement/restraint rules, pacing, the
 * dawn deadline — is isolated to Blackwood and cannot affect any other game.
 * Specialize by replacing the delegation below with Blackwood-owned steps that
 * call the shared primitives it wants and override the ones it doesn't.
 */
import { runTurnPipeline } from "../turn-pipeline.js";
import type { GameModule, TurnRequest, PlatformServices, TurnResult } from "./types.js";

export const BLACKWOOD_ID = "blackwood-inheritance";

/** Blackwood-owned voice + rules — the first per-game specialization. */
const BLACKWOOD_GUIDANCE = {
  director:
    "Blackwood is a rain-soaked country-house night. Suspects are grieving, " +
    "guarded, and proud — they resist with cold refusal and social pressure, " +
    "never by physically restraining a police inspector over a conversation. " +
    "Reserve hold_player/restrain for a genuine, capable threat.",
  performer:
    "Tone: gothic and candle-lit, the storm against the glass; dry, literate, " +
    "never lurid. Keep NPC replies clipped and class-conscious. The night runs " +
    "toward dawn — let the passage of time press quietly on the scene.",
};

export const blackwoodGame: GameModule = {
  id: BLACKWOOD_ID,

  async runTurn(req: TurnRequest, svc: PlatformServices): Promise<TurnResult> {
    // --- Blackwood turn: shared pipeline + Blackwood-owned guidance. Pull more
    // of the turn behind this seam (prompts, movement, the dawn deadline) as it
    // needs to diverge — isolated from every other game. ---
    return runTurnPipeline({
      def: req.def,
      state: req.state,
      playerInput: req.playerInput,
      llmConfig: svc.llmConfig,
      guidance: BLACKWOOD_GUIDANCE,
    });
  },
};
