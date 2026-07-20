# Turn pipeline (two AI calls)

**Status:** Implemented (v1)  
**Date:** 2026-07-18

## Flow

```
Player free text
    │
    ▼
┌───────────────────┐
│ Call #1 DIRECTOR  │  intents + physical (world→player classify)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ ENGINE            │
│  1 intents→patch  │
│  2 accuse gate    │
│  3 apply patch    │  doors, evidence, flags, accuse…
│  4 evaluate beats │  authored plot effects (incl. harm/hold/steal)
│  5 WORLD→PLAYER   │  resolveWorldToPlayer — core phase
│                   │  assault / provoke / eject / hazard / seize
│                   │  + defaults when no case beat handled it
│  6 justHappened   │  discoveries, inventory, accuse…
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Call #2 PERFORMER │  narration + dialogue only
│                   │  must stage world→player events
└─────────┬─────────┘
          ▼
     Persist + UI
```

## World → player (core engine phase)

**Code:** `packages/engine/src/resolve-world-to-player.ts`

The player is not only an actor. Each turn the engine asks: *what happens TO them?*

**Open situations, fixed tools.** We do not maintain a catalog of every possible trouble.
The AI proposes compositions of allowlisted effects; the engine validates and applies.

| Input | Engine result |
|-------|----------------|
| Director `worldToPlayer.effects[]` | Sanitize allowlist + apply |
| Authored beats (`harm_player`, `hold_player`, `move_player`, `steal_…`) | Beat pass |
| Location `hazards` | Fall / soak / injure |
| Move while `control ≠ free` | Blocked |

Effect allowlist: `WORLD_TO_PLAYER_EFFECT_TYPES` (move, harm, hold, steal, threat, willingness, …).  
Ids must exist in the closed-world pack.

## Rules

1. **Presentation never mutates authoritative state.**
2. **Director** may suggest a patch and must classify `physical`; **engine** is authority.
3. **Performer** must honor `justHappened` (including world→player) and default-deny knowledge.
4. Without `OPENROUTER_API_KEY`, both calls use heuristics.
5. **Accuse gate** (`packages/engine/src/accuse-gate.ts`): informal accusations
   become `pendingAccusation` and must be confirmed in-fiction (or worded
   formally — "I accuse X") before scoring. Scoring is negation-aware
   ("it wasn't X" never counts as naming X). Naming suspects sets generic
   `accused_<id>` / `falsely_accused_<id>` game flags for definition-driven
   reactions — no per-case engine hardcodes. Config: definition `accusePolicy`
   (`requireConfirmation`, default true; `pendingTurns`, default 3).

## Prompt caching (prefix-stable layout)

Providers cache the longest byte-identical message prefix (DeepSeek/OpenAI
automatically; Anthropic via explicit breakpoints). Both calls therefore send:

1. Static system prompt (per role)
2. `## Case reference` — memoized static case JSON
   (`packages/engine/src/static-pack.ts`, `staticCasePackJson(def)`): case
   meta, cast directory, base geography, static policy. Leak-safe by test —
   no solution, knowledge, evidence catalog, endings, or beat hints.
3. `## Current turn state` — per-turn pack, compact JSON, with static
   duplicates stripped (`packages/llm/src/prompt-blocks.ts`)
4. Player input / engine notes / justHappened — most volatile, last

Retry paths preserve the prefix (soft-retry appends to the end; repair rounds
append messages). Do not put per-turn content ahead of the case reference.

## Scene dressing (improvised canon)

The performer may enrich the world with durable texture the author never
wrote (a chandelier, a worn rug) and reports it as structured
`dressing[]` entries `{scope, id, subject, detail}` alongside narration.
The engine validates (closed-world ids, 5/turn, 160 chars, 6 facts per
subject, 12 subjects per target, dedupe) and stores facts on the target's
runtime state (`locationState/characterState/objectState .dressing`).
Facts about the same `subject` form an append-only cumulative thread
("chandelier: hangs over the stairwell; five hundred crystals"), replayed
into every future ContextPack as `establishedDetails` — so the model sees
what it already established before it speaks, and turn-40 prose cannot
contradict turn-1 improvisation.

Boundary: dressing is timeless texture only — never events, damage,
evidence, or state changes (those belong to the engine). Inspecting a
dressed detail yields atmosphere, never clues, unless authored content
says otherwise. Code: `packages/engine/src/dressing.ts`.

## Models (env)

| Env | Role |
|-----|------|
| `LLM_DIRECTOR_MODEL` | Call #1 (optional; defaults to narrator model) |
| `LLM_NARRATOR_MODEL` | Call #2 performer |

## Boundaries (anti-sidestep / abuse)

Free-text play can try to jailbreak, spoil, abuse, use magic, or abandon the case.
Handling is layered:

1. **Local detector** (`packages/engine/src/boundaries.ts`) — high-precision regex pre-scan  
2. **Director** — may emit `{ type: "other", note: "blocked_*" }`  
3. **Engine** — `neutralizePatchForBoundary` strips moves/evidence/accuse; adds `justHappened` with performer hints  
4. **Performer** — brief in-world refusal; no spoilers, no depicting abuse, no successful superpowers  

Codes: `blocked_ooc` | `blocked_solution` | `blocked_abuse` | `blocked_impossible` | `blocked_illegal`  
Legitimate investigation and normal accusations are never blocked.

## Retries & failure handling

Implemented in `packages/llm` (`client.ts`, `retry.ts`):

1. **Transport** — 429 / 5xx / network / timeout: up to **3** attempts with exponential backoff (+ `Retry-After` when present).
2. **Invalid JSON** — one repair turn: “reply with ONLY valid JSON”.
3. **Schema (Zod)** — one repair turn with validation issues listed.
4. **Soft failures** — one full re-ask:
   - Director: substantive input but only empty `other` intent
   - Performer: empty / tiny narration
5. **Last resort** — heuristic fallback (`degraded: true` on the call result; not silent forever-retries).

Non-retryable: 401/403, most 400s (wrong model / bad request).

## Code

- `packages/llm/src/director.ts` / `performer.ts` / `client.ts` / `retry.ts`
- `packages/engine/src/intents-to-patch.ts`
- `apps/api/src/turn-pipeline.ts`
