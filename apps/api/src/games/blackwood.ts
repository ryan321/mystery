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

export const blackwoodGame: GameModule = {
  id: BLACKWOOD_ID,

  async runTurn(req: TurnRequest, svc: PlatformServices): Promise<TurnResult> {
    // --- Blackwood turn (currently the shared pipeline; specialize here) ---
    return runTurnPipeline({
      def: req.def,
      state: req.state,
      playerInput: req.playerInput,
      llmConfig: svc.llmConfig,
    });
  },
};
