/**
 * Back-compat surface for imports of `runTurnPipeline` / `turnHardCap`.
 * New code should use `standardTurn` from `./games/standard-turn.js`.
 */
export {
  standardTurn,
  runTurnPipeline,
  turnHardCap,
} from "./games/standard-turn.js";
export type { TurnResult as TurnPipelineResult } from "./games/types.js";
