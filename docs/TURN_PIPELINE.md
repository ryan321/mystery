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
│ ENGINE            │  intents → patch → validateAndApplyPatch
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

## Models (env)

| Env | Role |
|-----|------|
| `LLM_DIRECTOR_MODEL` | Call #1 (optional; defaults to narrator model) |
| `LLM_NARRATOR_MODEL` | Call #2 performer |

## Code

- `packages/llm/src/director.ts` / `performer.ts`
- `packages/engine/src/intents-to-patch.ts`
- `apps/api/src/turn-pipeline.ts`
