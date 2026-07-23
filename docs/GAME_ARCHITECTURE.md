# Game architecture — platform + per-game modules

**Status:** In progress (scaffolding)
**Date:** 2026-07-23

## The decision

We are moving from **one shared engine that runs every mystery as a config** to
**a shared platform that hosts per-mystery game modules**. Each mystery is its
own game *code*, not a `definition.json` fed through a fixed pipeline.

### Why

The shared "uber-engine" had two ceilings and one growing risk:

- **Config ceiling** — expressing a mystery's specific mechanics as more and
  more schema flags slowly reinvents a programming language in JSON.
- **Generic-engine ceiling** — one pipeline trying to be correct for every
  mystery stays generic: master of none.
- **Collision risk (the decisive one)** — almost every gameplay failure we hit
  was *one mystery's* edge case (a hold that should be breakable here but not in
  the asylum ward; a dawn deadline; presence rules; far-move). Fixing it in the
  shared engine put **every other mystery at risk**. Concretely: changing "held"
  semantics to free one trapped player immediately broke the white-room ward's
  intended restraint. That is the "change the engine for one game, break 100
  others" failure, and it is structural.

With AI writing the code, "more code" is cheap; **isolation** is the win. A
change to game X's rules must not be able to touch game Y.

## The line: platform vs. game

Draw it deliberately. The rule of thumb: **isolate where collisions live
(gameplay/narrative); share where sharing removes risk and has no gameplay
semantics to collide on (plumbing/security).**

| Concern | Platform (shared library) | Game module (per-mystery, owned) |
|---|---|---|
| LLM plumbing (client, retry, streaming, caching, timeouts) | ✅ | |
| State persistence + turn transaction + optimistic lock | ✅ | |
| Auth / billing / access / tiers | ✅ | |
| **Integrity boundary** — playthrough ownership, `RESERVED_FLAGS` solution-leak guard, closed-world id filtering at the API edge | ✅ | |
| HTTP API surface, studio, bundle/registry | ✅ | |
| Director logic, prompts, voice, few-shot | | ✅ |
| Narrator logic, presence/dialogue rules, tone | | ✅ |
| Movement, restraint, deadlines, beats, pacing | | ✅ |
| State model & mechanics specific to the mystery | | ✅ |

**The integrity boundary stays on the platform on purpose.** Forking security
per game = 100 subtly-different IDORs and solution leaks. Those checks have no
gameplay semantics to collide on, so sharing them is pure upside (fix once,
every game safe). This is the one place per-game code must *not* reach.

## The inversion

Today the engine is in charge and runs a definition. Flip it: **each game is in
charge and *calls* the platform's services.** The platform hands a game module a
turn request + persisted state + an authenticated LLM client; the game's own
code decides everything about the turn and hands back a result. The platform
never reaches into gameplay; the game never reimplements plumbing or security.

## The contract

A game module implements one seam to start — the turn — and will grow:

```ts
// apps/api/src/games/types.ts
export type TurnRequest = {
  def: MysteryDefinition;      // the loaded, version-pinned definition
  state: PlaythroughState;     // persisted state for this playthrough
  playerInput: string;
};

export type PlatformServices = {
  llmConfig: LlmConfig | null; // shared LLM plumbing/config; null → heuristic
};

export type TurnResult = TurnPipelineResult; // narration, dialogue, next state, …

export interface GameModule {
  readonly id: string;                       // caseId this module serves
  runTurn(req: TurnRequest, svc: PlatformServices): Promise<TurnResult>;
  // Future seams as needed: createInitialState, buildPlayerView, buildBriefing,
  // computeProgress, debrief — each defaulting to the shared implementation
  // until a game overrides it.
}
```

The API turns route dispatches through the registry instead of calling one
pipeline:

```ts
const game = gameFor(state.caseId);              // per-game module or default
result = await game.runTurn({ def, state, playerInput }, { llmConfig });
```

## Migration path (incremental, no big-bang)

1. **Seam + registry (this pass).** Define `GameModule`, a `gameFor(caseId)`
   registry, a **default module** that delegates to the current shared pipeline
   (so nothing breaks), and dispatch the turns route through it.
2. **Blackwood becomes the first owned module.** Its `runTurn` starts by
   composing the shared engine + LLM *as libraries*, then progressively pulls
   the parts it wants to specialize (movement, restraint, prompts, pacing) into
   its own code — free to diverge because nothing else uses it.
3. **Each new/reworked mystery is authored as its own module**, starting from a
   copyable starter (sensible defaults), not a shared runtime dependency.
4. The engine (`packages/engine`) and LLM (`packages/llm`) packages become
   **libraries of primitives games call**, not a pipeline that runs them.

## What does NOT change

The whole platform layer we've hardened this session stays shared and keeps
improving for every game at once: security fixes, graceful-shutdown, retry/
caching/latency work, persistence. Games inherit all of it for free.
