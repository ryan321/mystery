# Game architecture — platform + per-game modules

**Status:** Implemented (contracts + standardTurn composition)  
**Date:** 2026-07-23  
**Canonical contract:** [PLATFORM_GAME_CONTRACT.md](./PLATFORM_GAME_CONTRACT.md)

## The decision

We host a **large library of diverse mysteries**. A single shared “uber-engine”
cannot absorb every nuance without collisions (fix hold for case A, break
restraint for case B). Each mystery may own **game code** for quality. The
platform is a **small shared floor**; games compose it.

**Player experience first.** Writing code per mystery is fine. Forking the
entire turn loop per mystery is not — that duplicates bugs and integrity
holes. Use `standardTurn` + hooks unless the case truly needs a custom loop.

## The line

| Concern | Platform | Game module |
|---|---|---|
| LLM plumbing, retry, caching | ✅ | |
| Persistence, turn transaction | ✅ | |
| Auth / billing / ownership | ✅ | |
| Integrity (sealing, closed world, RESERVED_FLAGS) | ✅ | |
| `standardTurn` helper | ✅ | calls it |
| Voice, pacing, case-only rules | | ✅ |
| Optional full custom turn | | ✅ (still uses engine primitives) |

## The inversion

The **game owns the turn**. The platform injects `Platform` services; the game
returns `TurnResult`. The host never hard-codes one mystery’s rules for all.

```ts
const platform = createPlatform(llmConfig);
const game = gameFor(state.caseId);
const result = await game.runTurn({ def, state, playerInput }, platform);
```

## Code map

| File | Role |
|---|---|
| `apps/api/src/games/types.ts` | `Platform`, `GameModule`, `TurnResult`, hooks |
| `apps/api/src/games/standard-turn.ts` | Composable default turn |
| `apps/api/src/games/registry.ts` | `gameFor`, `createPlatform`, view helpers |
| `apps/api/src/games/default-game.ts` | Thin default module |
| `apps/api/src/games/<case>.ts` | Owned modules (voice + hooks) |
| `packages/engine` | Pure primitives (patch, packs, score, project) |
| `packages/llm` | Director / performer / client |

## Adding a case

See [PLATFORM_GAME_CONTRACT.md](./PLATFORM_GAME_CONTRACT.md) § Adding a mystery.

## What does not change

Security, sealing, and plumbing stay platform-owned and improve for every game
at once. Games inherit them by composition, not by copy-paste.
