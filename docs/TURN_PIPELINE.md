# Turn pipeline (two AI calls)

**Status:** Implemented (v1)  
**Date:** 2026-07-18

## Flow

```
Player free text
    │
    ▼
┌───────────────────┐
│ Call #1 DIRECTOR  │  structured intents only (JSON)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ ENGINE            │  intents → patch → accuse gate →
│                   │  validateAndApplyPatch
│                   │  (doors, evidence, flags, accuse…)
│                   │  build justHappened
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Call #2 PERFORMER │  narration + dialogue only (JSON)
│                   │  sees post-commit ContextPack
└─────────┬─────────┘
          ▼
     Persist + UI
```

## Rules

1. **Presentation never mutates authoritative state.**
2. **Director** may suggest a patch; **engine** is authority.
3. **Performer** must honor `justHappened` and default-deny character knowledge.
4. Without `OPENROUTER_API_KEY`, both calls use heuristics.
5. **Accuse gate** (`packages/engine/src/accuse-gate.ts`): informal accusations
   become `pendingAccusation` and must be confirmed in-fiction (or worded
   formally — "I accuse X") before scoring. Scoring is negation-aware
   ("it wasn't X" never counts as naming X). Naming suspects sets generic
   `accused_<id>` / `falsely_accused_<id>` game flags for definition-driven
   reactions — no per-case engine hardcodes. Config: definition `accusePolicy`
   (`requireConfirmation`, default true; `pendingTurns`, default 3).

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
