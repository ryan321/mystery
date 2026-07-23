/**
 * Blackwood Inheritance — its own game. It owns its turn loop
 * (./blackwood-turn.ts), its voice (baked in there), its dawn-pressure pacing,
 * and its opening state. It composes the shared engine + LLM primitives, but
 * the orchestration and rules here are Blackwood's — changing them cannot touch
 * any other game (docs/GAME_ARCHITECTURE.md).
 */
import { createInitialPlaythrough } from "@mystery/engine";
import type { MysteryDefinition, PlaythroughState } from "@mystery/shared";
import { runBlackwoodTurn } from "./blackwood-turn.js";
import type {
  GameModule,
  TurnRequest,
  PlatformServices,
  TurnResult,
} from "./types.js";

export const BLACKWOOD_ID = "blackwood-inheritance";

export const blackwoodGame: GameModule = {
  id: BLACKWOOD_ID,

  runTurn(req: TurnRequest, svc: PlatformServices): Promise<TurnResult> {
    return runBlackwoodTurn({
      def: req.def,
      state: req.state,
      playerInput: req.playerInput,
      llmConfig: svc.llmConfig,
    });
  },

  createInitialState(def: MysteryDefinition): PlaythroughState {
    // Blackwood owns its opening state. The standard storm-lashed midnight start
    // for now; Blackwood-specific seeding (opening flags, a head-start clock)
    // goes here as it diverges.
    return createInitialPlaythrough(def);
  },
};
