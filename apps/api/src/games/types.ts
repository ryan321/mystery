/**
 * Game-module contract (docs/GAME_ARCHITECTURE.md).
 *
 * Each mystery is its own game module — its gameplay/narrative code — that the
 * platform hosts. The platform (this app) owns plumbing, persistence, and the
 * integrity boundary; a game module owns the turn. The turn is the first and
 * heart seam; the interface will grow (initial state, views, progress, debrief)
 * with each seam defaulting to the shared implementation until a game overrides.
 */
import type { MysteryDefinition, PlaythroughState } from "@mystery/shared";
import type { LlmConfig } from "@mystery/llm";
import type { TurnPipelineResult } from "../turn-pipeline.js";

/** Everything a game needs to resolve one turn. */
export type TurnRequest = {
  /** Loaded, version-pinned definition for this playthrough. */
  def: MysteryDefinition;
  /** Persisted state for this playthrough. */
  state: PlaythroughState;
  /** Raw player free text (already trimmed + length-capped by the platform). */
  playerInput: string;
};

/** Shared platform services handed to a game. Plumbing only — never gameplay. */
export type PlatformServices = {
  /** Shared LLM config/plumbing; null → heuristic (no OPENROUTER_API_KEY). */
  llmConfig: LlmConfig | null;
};

/** Narration, dialogue, next state, applied patch, debug — see turn-pipeline. */
export type TurnResult = TurnPipelineResult;

/**
 * A hosted mystery. The platform dispatches a turn to `runTurn`; the module
 * decides everything about it and returns the result. The platform commits the
 * state and enforces the integrity boundary around this call.
 */
export interface GameModule {
  /** The caseId this module serves. */
  readonly id: string;
  runTurn(req: TurnRequest, svc: PlatformServices): Promise<TurnResult>;
}
