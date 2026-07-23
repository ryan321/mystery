/**
 * Default game module — every case without its own module.
 * Composes `standardTurn` with no special voice/hooks. Own a module when a
 * mystery needs quality-critical divergence (voice, pacing, rules).
 */
import { standardTurn } from "./standard-turn.js";
import type { GameModule, TurnRequest, Platform, TurnResult } from "./types.js";

export function createDefaultGame(id: string): GameModule {
  return {
    id,
    runTurn(req: TurnRequest, platform: Platform): Promise<TurnResult> {
      return standardTurn(req, platform);
    },
  };
}
