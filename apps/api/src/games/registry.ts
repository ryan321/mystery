/**
 * Game registry + platform factory.
 *
 * Dispatch: caseId → GameModule (owned) or default module.
 * Platform: shared floor injected into every runTurn — integrity projections
 * and LLM config only; gameplay lives in the module.
 */
import type { JustHappened, MysteryDefinition, PlaythroughState } from "@mystery/shared";
import {
  buildPlayerView,
  computeMysteryProgress,
  createInitialPlaythrough,
  type MysteryProgress,
  type PlayerView,
} from "@mystery/engine";
import type { LlmConfig } from "@mystery/llm";
import type { GameModule, Platform } from "./types.js";
import { createDefaultGame } from "./default-game.js";
import { blackwoodGame } from "./blackwood.js";

/** Mysteries that own game code. Register each high-quality case here. */
const GAMES: GameModule[] = [blackwoodGame];

const byId = new Map<string, GameModule>(GAMES.map((g) => [g.id, g]));

/** The game module for a case, or a default module bound to that caseId. */
export function gameFor(caseId: string): GameModule {
  return byId.get(caseId) ?? createDefaultGame(caseId);
}

/** Build the platform services object for this request/process. */
export function createPlatform(llmConfig: LlmConfig | null): Platform {
  return {
    llmConfig,
    createInitialState(def: MysteryDefinition): PlaythroughState {
      return createInitialPlaythrough(def);
    },
    buildPlayerView(def: MysteryDefinition, state: PlaythroughState): PlayerView {
      return buildPlayerView(def, state);
    },
    computeProgress(
      def: MysteryDefinition,
      state: PlaythroughState,
      opts?: {
        previous?: PlaythroughState | null;
        justHappened?: JustHappened[];
        evidenceAdded?: string[];
      }
    ): MysteryProgress {
      return computeMysteryProgress(def, state, opts);
    },
  };
}

/** Opening state via the game module (or platform default). */
export function initialStateFor(
  caseId: string,
  def: MysteryDefinition,
  platform?: Platform
): PlaythroughState {
  const game = gameFor(caseId);
  if (game.createInitialState) return game.createInitialState(def);
  if (platform) return platform.createInitialState(def);
  return createInitialPlaythrough(def);
}

/** Leak-safe player UI projection via game override or platform. */
export function playerViewFor(
  def: MysteryDefinition,
  state: PlaythroughState,
  platform?: Platform
): PlayerView {
  const game = gameFor(def.id);
  if (game.buildPlayerView) return game.buildPlayerView(def, state);
  if (platform) return platform.buildPlayerView(def, state);
  return buildPlayerView(def, state);
}

/** Progress via game override or platform. */
export function progressFor(
  def: MysteryDefinition,
  state: PlaythroughState,
  opts?: {
    previous?: PlaythroughState | null;
    justHappened?: JustHappened[];
    evidenceAdded?: string[];
  },
  platform?: Platform
): MysteryProgress {
  const game = gameFor(def.id);
  if (game.computeProgress) return game.computeProgress(def, state, opts);
  if (platform) return platform.computeProgress(def, state, opts);
  return computeMysteryProgress(def, state, opts);
}
