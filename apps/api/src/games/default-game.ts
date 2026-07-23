/**
 * Default game module: composes the shared engine + LLM pipeline. Every mystery
 * that hasn't been reworked into its own module inherits this behavior, so the
 * dispatch seam is live without a big-bang migration. As a mystery is authored
 * as its own module it stops using this and owns its turn (see blackwood.ts).
 */
import { runTurnPipeline } from "../turn-pipeline.js";
import type { GameModule, TurnRequest, PlatformServices, TurnResult } from "./types.js";

export function createDefaultGame(id: string): GameModule {
  return {
    id,
    runTurn(req: TurnRequest, svc: PlatformServices): Promise<TurnResult> {
      return runTurnPipeline({
        def: req.def,
        state: req.state,
        playerInput: req.playerInput,
        llmConfig: svc.llmConfig,
      });
    },
  };
}
