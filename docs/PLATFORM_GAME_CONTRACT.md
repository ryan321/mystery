# Platform / game contract

**Status:** Implemented (contracts + `standardTurn`)  
**Date:** 2026-07-23  
**Related:** [GAME_ARCHITECTURE.md](./GAME_ARCHITECTURE.md), [INVESTIGATION_MODEL.md](./INVESTIGATION_MODEL.md)

This is the law for scaling a **large library of diverse mysteries** without
a god-engine or N forked pipelines. Player experience (quality, fun, fairness,
speed) beats minimizing per-game code — **write game code when quality needs
it**, but never reimplement integrity.

---

## Mental model

```
┌──────────────────────────────────────────────────────────┐
│ PLATFORM  — shared floor (boring, hard to break)         │
│  integrity · persistence · LLM plumbing                  │
│  closed world · sealed solution · patch apply            │
│  accuse scoring · leak-safe PlayerView · investigation   │
│  standardTurn helper (composable default loop)           │
└──────────────────────────────────────────────────────────┘
                         ▲ call
                         │
┌──────────────────────────────────────────────────────────┐
│ GAME MODULE  — one per mystery that needs nuance         │
│  voice · pacing hooks · case-only rules                  │
│  owns runTurn for this caseId                            │
│  usually: standardTurn(req, platform, { guidance, hooks })│
└──────────────────────────────────────────────────────────┘
                         ▲ loads
                         │
┌──────────────────────────────────────────────────────────┐
│ CONTENT  — definition for that mystery                   │
│  world · people · items · deductions · solution · ending │
└──────────────────────────────────────────────────────────┘
```

**Rule:** Isolate where collisions live (gameplay/narrative). Share where
sharing has no gameplay semantics (plumbing/security).

**Rule:** A change to game A must not break game B.

**Rule:** Prefer `standardTurn` + hooks over copying the turn loop.

---

## Contracts (code)

| Type | Path | Role |
|---|---|---|
| `Platform` | `apps/api/src/games/types.ts` | Injected services: llm, createInitialState, buildPlayerView, computeProgress |
| `GameModule` | same | `id`, `runTurn`, optional overrides |
| `TurnRequest` / `TurnResult` | same | Stable turn I/O |
| `StandardTurnOptions` | same | `guidance`, `afterTick` |
| `standardTurn` | `apps/api/src/games/standard-turn.ts` | Default composition |
| `createPlatform` / `gameFor` | `apps/api/src/games/registry.ts` | Host wiring |

### Platform (floor)

```ts
type Platform = {
  llmConfig: LlmConfig | null;
  createInitialState(def): PlaythroughState;
  buildPlayerView(def, state): PlayerView;       // includes investigation
  computeProgress(def, state, opts?): MysteryProgress;
};
```

Games **must not** invent parallel scoring, sealing, or closed-world checks.

### GameModule

```ts
interface GameModule {
  id: string;
  runTurn(req: TurnRequest, platform: Platform): Promise<TurnResult>;
  createInitialState?(def): PlaythroughState;   // omit → platform
  buildPlayerView?(def, state): PlayerView;
  computeProgress?(...): MysteryProgress;
}
```

### standardTurn options

```ts
type StandardTurnOptions = {
  guidance?: { director?: string; performer?: string };
  afterTick?: (ctx) => { state?, justHappened? } | void;
};
```

Example owned game:

```ts
export const myGame: GameModule = {
  id: "my-case",
  runTurn: (req, platform) =>
    standardTurn(req, platform, {
      guidance: { director: "...", performer: "..." },
      afterTick: ({ state }) => ({ justHappened: maybePressure(state) }),
    }),
};
```

Fully custom `runTurn` is allowed when quality demands it — still call engine
primitives for patch apply, world→player, performer filtering, boundaries.

---

## What stays on the platform forever

- Auth, billing, playthrough ownership  
- `RESERVED_FLAGS` / solution leak guards  
- Closed-world id allowlists  
- Accuse rubric scoring  
- Leak-safe `PlayerView` / investigation projection  
- LLM client, retry, caching  
- Persistence / turn commit  

## What lives in game modules

- Voice and few-shot emphasis (guidance strings)  
- Pacing (dawn clocks, act structure) via `afterTick` or custom turn  
- Case-only movement/restraint policy (when standard policy is wrong)  
- Anything that would break another mystery if shared  

## What lives in content (definition)

- Map, cast, items, knowledge  
- Deduction graph (path to solve)  
- Solution + rubric + endings  
- Opening package, map coords, imagery  

Content is **not** a programming language for every mechanic. Prefer game code
for one-off rules.

---

## Adding a mystery to the library

1. Author content (`content/cases/<id>/definition.json`).  
2. If default quality is enough: **no module** — `createDefaultGame` + `standardTurn`.  
3. If quality needs voice/pacing/rules: add `apps/api/src/games/<id>.ts`, register in `registry.ts`.  
4. Prefer hooks over a private turn file.  
5. Never add a one-off shared engine flag “for everyone.”  

---

## Integrity

One shared composition (`standardTurn`) invokes:

- `directorIntentsToPatch`  
- `validateAndApplyPatch`  
- `resolveWorldToPlayer`  
- `neutralizePatchForBoundary`  
- `runPerformer`  

Guarded by `apps/api/src/games/integrity.test.ts`. Custom turns must keep these.

---

## Player experience completeness (related)

Architecture alone does not make a mystery fun. Also required:

| Surface | Status |
|---|---|
| Freeform turn (director/performer) | ✅ |
| Scene / map / cast / inventory | ✅ |
| Investigation on PlayerView | ✅ data |
| Casebook / Help UI | ⏳ build next |
| Authored deduction graphs per case | ⏳ library rewrite |

---

## Anti-patterns

| Don’t | Do |
|---|---|
| Copy `standard-turn.ts` per game | `standardTurn` + options |
| Put Blackwood-only hold rules in shared engine | Guidance or game policy |
| Grow 64 more shared effects for one case | Game code + content |
| Parallel wire formats per game | Stable `TurnResult` / `PlayerView` |
| Skip integrity “just this once” | Always use engine primitives |
