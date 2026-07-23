/**
 * Platform ↔ game contracts.
 *
 * Mental model (docs/PLATFORM_GAME_CONTRACT.md, docs/GAME_ARCHITECTURE.md):
 *
 *   PLATFORM  — integrity, plumbing, pure projections, composable turn helper
 *   GAME      — owns the turn for one caseId; free to diverge on voice/rules
 *   CONTENT   — definition data the game interprets
 *   SURFACES  — PlayerView (ambient free / discovery earned)
 *
 * Games may write as much code as they need for quality. Isolation is the
 * point: a change to game A must not break game B. Prefer calling
 * `standardTurn` with hooks over forking the whole loop.
 */
import type {
  JustHappened,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import type {
  MysteryProgress,
  PlayerView,
} from "@mystery/engine";
import type { LlmConfig } from "@mystery/llm";

// ── Turn I/O (stable wire shape for API + every game) ────────────────────

export type TurnRequest = {
  def: MysteryDefinition;
  state: PlaythroughState;
  playerInput: string;
};

export type TurnDebug = {
  directorModel: string;
  performerModel: string;
  directorMock: boolean;
  performerMock: boolean;
  directorDegraded?: boolean;
  performerDegraded?: boolean;
  directorLatencyMs: number;
  performerLatencyMs: number;
  directorAttempts?: number;
  performerAttempts?: number;
  intentNotes: string[];
  focusCharacterId?: string;
  beatsFired: string[];
};

/** Stable turn result — API and clients depend on this shape. */
export type TurnResult = {
  narration: string;
  dialogue: { characterId: string; characterName: string; text: string }[];
  state: PlaythroughState;
  appliedPatch: unknown;
  rejected: string[];
  evidenceAdded: string[];
  justHappened: JustHappened[];
  debug: TurnDebug;
};

/** @deprecated Use TurnResult — same shape. */
export type TurnPipelineResult = TurnResult;

// ── Platform services (shared floor; games call these, never reimplement) ─

/**
 * Services the host injects into every game. Plumbing + integrity only —
 * no mystery flavor. Games must not bypass sealing / closed-world / scoring
 * by inventing parallel paths.
 */
export type Platform = {
  /** LLM client config; null → heuristic (no key). */
  llmConfig: LlmConfig | null;

  /** Default opening state (definition seeds). */
  createInitialState(def: MysteryDefinition): PlaythroughState;

  /** Leak-safe player UI projection (includes investigation casebook). */
  buildPlayerView(def: MysteryDefinition, state: PlaythroughState): PlayerView;

  /** Structural progress + investigation sibling (not a solve bar). */
  computeProgress(
    def: MysteryDefinition,
    state: PlaythroughState,
    opts?: {
      previous?: PlaythroughState | null;
      justHappened?: JustHappened[];
      evidenceAdded?: string[];
    }
  ): MysteryProgress;
};

/** @deprecated Use Platform — same idea, old name. */
export type PlatformServices = Platform;

// ── Game hooks for standardTurn (isolation without forking) ──────────────

export type TickHookContext = {
  def: MysteryDefinition;
  /** State after passive time + tick beats + hard-cap resolution. */
  state: PlaythroughState;
  justHappened: JustHappened[];
};

export type TickHookResult = {
  state?: PlaythroughState;
  justHappened?: JustHappened[];
};

/**
 * Options when a game composes the shared `standardTurn` helper.
 * Voice + pacing + one-off justHappened live here — not in shared engine flags.
 */
export type StandardTurnOptions = {
  /** Appended to director / performer system prompts. */
  guidance?: { director?: string; performer?: string };
  /**
   * After world tick, before director. Edge-triggered dawn pressure, custom
   * clocks, etc. Return patches to state / extra justHappened.
   */
  afterTick?: (ctx: TickHookContext) => TickHookResult | void;
};

// ── Game module (one per mystery that owns special rules; others use default)

/**
 * A hosted mystery. The platform dispatches by caseId; the module owns how
 * that mystery plays. Quality > minimal code — write what the case needs —
 * but do not reimplement integrity, sealing, or persistence.
 */
export interface GameModule {
  /** caseId this module serves. */
  readonly id: string;

  /**
   * Resolve one turn. Prefer:
   *   return standardTurn(req, platform, { guidance, afterTick })
   * Fully custom loops are allowed when a case cannot fit standardTurn —
   * still use platform projections and engine primitives for sealing/scoring.
   */
  runTurn(req: TurnRequest, platform: Platform): Promise<TurnResult>;

  /**
   * Opening state. Omit → platform.createInitialState(def).
   * Override to seed case-specific flags/clocks.
   */
  createInitialState?(def: MysteryDefinition): PlaythroughState;

  /** Omit → platform.buildPlayerView. */
  buildPlayerView?(
    def: MysteryDefinition,
    state: PlaythroughState
  ): PlayerView;

  /** Omit → platform.computeProgress. */
  computeProgress?(
    def: MysteryDefinition,
    state: PlaythroughState,
    opts?: {
      previous?: PlaythroughState | null;
      justHappened?: JustHappened[];
      evidenceAdded?: string[];
    }
  ): MysteryProgress;
}
