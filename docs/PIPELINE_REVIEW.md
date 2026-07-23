# Turn-pipeline review — findings & plan

**Date:** 2026-07-23 · Three-agent review across the four axes (correctness /
recovery / speed / cost — see docs/TURN_PIPELINE.md). Ranked by leverage.

A normal turn makes **3 LLM calls** (director ∥ classify-physical, then
performer); accuse turns make 4 (+ extract-accusation). Worst-case retry
fan-out was the mechanism behind the 230s "Load error" turns.

## Done

- **SDK retries off + 60s client timeout** (`client.ts`). The OpenAI SDK's own
  `maxRetries:2` + 10-min timeout stacked under our classified-retry layer (up
  to 9 hidden HTTP requests; a single stuck call hung the whole turn). — c190be7
- **Retry-ladder trim.** performer `softRetry:false` (acceptSoftValue already
  ships the soft value) + `maxTransportRetries` 2→1 on both big calls; token
  ceilings (performer 1200, director 700, classify 256). — c190be7
- **Aux-model lever** (`LLM_AUX_MODEL`) for classify-physical + extract-accusation
  (default = director model; set to a cheap model to realize the win). — c190be7
- **Adapt-to-the-model** (earlier): `pruneNulls` (director coerces null optionals)
  + performer `acceptSoftValue` (ships soft prose over heuristic). — 36bf215

## Next — Tier 1 (high leverage)

- **Lean director pack** — the director runs first on every turn's serial path
  and is handed the full acting-detail pack (`charactersHereDetailed`,
  `activeCharacter`, `socialSurface`, `figures`, per-character memory) it never
  reads. A slim director-pack variant (`context-pack.ts`) is the biggest single
  cost+latency win. Needs a smoke test (don't drop a field the director uses).
  *Axis 3/4.*
- **Make the last-resort heuristic speak** (`heuristic.ts` `heuristicPerform`) —
  it always returns `dialogue: []`, so a fallback mid-conversation gives scenery
  and no reply: the reported "characters wouldn't talk." Emit one closed-world
  in-character line from the pack (`voice`/`willingness`/`allowedKnowledge`).
  *Axis 2/1. (Becomes per-game under the game-module arch; shared default helps now.)*
- **Client turn deadline** — `apps/web/src/lib/api.ts sendTurn` has no
  `AbortController`, so a slow turn hangs until the browser/edge cuts it and
  reads as a "Load error." Arm ~90s and fail predictably. *Axis 3/2.*

## Next — Tier 2 (medium)

- **Prompt caching via `cache_control`** — the static-case prefix earns nothing
  on Anthropic models (no breakpoints sent). **Conditional:** current
  deepseek/qwen auto-cache on prefix, so only worth it when the model is
  Anthropic. Do it if/when Sonnet/Opus is the model. *Axis 4/3.*
- **Stream the performer** — total time unchanged, but streaming the narration
  collapses *perceived* latency and removes the dead gap. Higher effort. *Axis 3.*
- **Context-pack dedup** — delete deprecated `evidenceHeld` (superset of
  `inventory`); move static `figures` into the cached static block; only send
  `activeCharacter` when the focus is absent; strip `at` timestamps from
  `recentTurns`. *Axis 4.*
- **Tighten presence regexes** (`performer.ts` — drop bare tokens `hands`/`shoes`/
  `weight`) to cut soft-flag false positives (less pressing now that soft-retry
  is off). *Axis 1/4.*
- **Delete dead legacy path** — `narrator.ts`, `prompts.ts` (`NARRATOR_SYSTEM`),
  `heuristic.ts heuristicNarrate` have no callers and mislead. *Hygiene.*

## Next — Tier 3 (gameplay → per-game under the game-module arch)

- **"Talk to an absent character" is silently dropped** (`intents-to-patch.ts`
  → `validate-patch.ts`): no move, no note, no `justHappened` — the request
  evaporates. Route the player toward them (reuse far-move) or surface a
  `justHappened`. *Axis 1.*
- **Local `blocked_solution` hard-neutralizes in-character interrogation**
  (`boundaries.ts` + `turn-pipeline.ts`): a local regex hit alone kills the turn,
  so "Tell me who did it, Henshaw!" is treated as a meta-cheat. Make local-only
  solution/impossible/illegal hits *advisory* (require the director to concur);
  keep abuse/OOC local-authoritative and all output-side leak guards hard. *Axis 1/2.*

## Integrity (confirmed correctly strict — do not loosen)

Closed-world id allowlists, `RESERVED_FLAGS` solution-leak guard (both director
and world→player paths), victim-not-accusable, `filterDialogueToPresent`,
playthrough ownership. These stay hard — they protect integrity, not style.
