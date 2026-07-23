/**
 * Game registry: caseId → its game module. A mystery with its own module is
 * dispatched to it; everything else falls back to the shared default pipeline.
 * This is the seam that makes per-game isolation possible — the platform never
 * hard-codes one pipeline for all cases (docs/GAME_ARCHITECTURE.md).
 */
import type { GameModule } from "./types.js";
import { createDefaultGame } from "./default-game.js";
import { blackwoodGame } from "./blackwood.js";

/** Mysteries that own their game code. Add a module here as it's authored. */
const GAMES: GameModule[] = [blackwoodGame];

const byId = new Map<string, GameModule>(GAMES.map((g) => [g.id, g]));

/** The game module for a case, or a shared-default module bound to that case. */
export function gameFor(caseId: string): GameModule {
  return byId.get(caseId) ?? createDefaultGame(caseId);
}
