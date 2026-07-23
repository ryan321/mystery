# The Investigation Model — first-class movement, location, items, and the deduction graph

**Status:** Partially implemented (schema + engine derivation + PlayerView)
**Date:** 2026-07-23
**Related:** [CASE_DEFINITION.md](./CASE_DEFINITION.md) (state model), [PLAYER_SURFACES.md](./PLAYER_SURFACES.md) (surfaces + fair play), [MYSTERY_PRINCIPLES.md](./MYSTERY_PRINCIPLES.md) (§9 WHAT #3 — the path to solving), [GAME_ARCHITECTURE.md](./GAME_ARCHITECTURE.md) (platform vs game module)

This doc defines the model we are rewriting cases onto. It elevates four things
to **first-class concerns** and adds the missing layer of the platform: a
representation of **how the case can be solved**, not just what is true.

### Implementation snapshot

| Piece | Status |
|---|---|
| `def.deductions` schema + superRefine (DAG, refs, minSupports) | ✅ |
| `computeInvestigation` (leads, readiness, casebook, help) | ✅ |
| `PlayerView.investigation` + `MysteryProgress.investigation` | ✅ |
| Items: `container` / `readable` / `usableOn` engine path | ✅ (`packages/engine/src/items.ts`) |
| Casebook / Help UI drawers | ⏳ not yet |
| Per-case authored graphs | ⏳ rewrite in progress |
| Movement resolver as first-class | ⏳ not yet (game-module territory) |

---

## 0. Why

Two problems, one root cause.

1. **"What do I do?"** A text prompt is a blank page. Genre-native players
   supply the verbs (search the room, examine the body, find the weapon)
   reflexively; everyone else stalls. This is an *affordance* problem, not a
   content problem — a brilliant case still opens on a blank box.
2. **"Am I getting anywhere?"** The platform models what *happens* (story
   beats), what *characters know* (knowledge beats), and what *is true*
   (`canon`/`solution`) — but **not what the player can deduce**. The chain of
   inference from evidence to accusation lives only in the author's head and in
   prose. `MYSTERY_PRINCIPLES` §9 (WHAT #3) already *requires* that chain to
   exist and be fair; it has just never been a data structure.

The root cause of both: locations, movement, and items are second-class next to
characters, and the deduction path is not modeled at all. Fix the model and the
guidance, progress, and fair-play checks all fall out of it.

---

## 1. First-class pillars

The world has four kinds of thing the player acts on. Characters are already
first-class (knowledge ladders, willingness, memory, identity fog). The other
three are being brought up to parity.

| Pillar | Today | Target |
|---|---|---|
| **Characters** | First-class ✅ | unchanged |
| **Location** | Rich schema, but access/territory ad hoc | First-class: access is authored and meaningful; territory + schedule; the map is a **reference** |
| **Movement** | An intent fuzzy-resolved per turn | First-class: a resolver that owns travel, reachability, summon-vs-move, following |
| **Items** | `evidence[]` — a flat clue list; keys and clues conflated; no affordances | First-class: `evidence[]` **enriched** with affordances (examine/use/read/open/contain); "learning" surfaced separately in the Casebook — derived, not a rename |

---

## 2. Fair-play invariants (do not break these)

These constrain everything below. They are the product's spine.

1. **The deduction graph is sealed, exactly like `canon`.** It never enters a
   Director or Performer pack. Only its *derived, spoiler-safe projection* (open
   question text + coarse readiness) is player-visible. Which clue proves what
   *is* the solution.
2. **The AI is a performer, never a coach.** It portrays the world and the
   people in it. It never steps out of fiction to tell the player what to do,
   never nudges, never "helps." Coaching trains players to *address the AI*
   ("have Bob come to me," "help me") — the exact mental model we reject
   (see [PLAYER_SURFACES.md] and the player-voice rule). Affordances live *in
   the narration* (an evocative room implies what to search); guidance lives in
   *static reference surfaces* the player opens themselves.
3. **Reference surfaces, not game surfaces.** Map, Cast, Inventory, Casebook,
   and the Help checklist are things the player *consults*. Nothing on them
   plays the game — **no point-and-click.** The player acts through text.
4. **The graph guides; it never gates.** Cold accusations stay allowed
   (`allowWithoutEvidence` default). The graph powers guidance, progress, and
   audits — it is never a permission check for solving.
5. **Guidance never leaks.** The static Help checklist is genre-universal
   ("searched everywhere? talked to everyone? found key items?"), decoupled
   from the solution. The Casebook shows only the player's *own* open
   questions and *earned* conclusions — never what the author knows matters.
6. **Additive and backward-compatible.** Only **Blackwood Inheritance** is
   rewritten onto this model. Every schema addition is optional (defaults that
   make an absent field behave as today), so the other cases keep parsing and
   playing unchanged. This rules out any rename of `evidence[]` — enrich in
   place; never break the 9 legacy cases or the engine's `evidenceIds` paths.

---

## 3. The deduction graph (the keystone)

A sealed DAG of the inferences that solve the case. Nodes are conclusions;
edges are dependencies; leaves are the evidence/knowledge that support each
conclusion. It sits beside `canon`/`solution` and is **the authoring artifact
for "how you figure it out."**

You already have the two ends: the **terminal** nodes are
`solution.rubric.requiredFacts` (identity / method / motive), and the **leaf
atoms** are `evidence[]` + character knowledge beats. What is new is the
**intermediate deductions and the edges between them** — the "this, then this,
then this."

```ts
// definition.ts — sealed, sits beside canon. Never in any AI pack.

export const DeductionSupportSchema = z.union([
  z.object({ evidenceId: z.string().min(1) }),                          // a clue held / noted
  z.object({ knowledge: z.object({ characterId: z.string(), beatId: z.string() }) }), // a person told you
  z.object({ nodeId: z.string().min(1) }),                             // a prior deduction
  z.object({ condition: ConditionSchema }),                            // escape hatch: any engine condition
]);

export const DeductionNodeSchema = z.object({
  id: z.string().min(1),
  /** Sealed, author-facing: the inference in plain terms. Never shown. */
  claim: z.string().min(1),
  /** Player-facing: the OPEN QUESTION this raises. The only text that surfaces. */
  question: z.string().min(1),
  /** identity | method | motive → terminal (ties to rubric). "lead" → intermediate. */
  role: z.enum(["identity", "method", "motive", "supporting", "lead"]).default("lead"),
  /** For terminal nodes: the rubric fact id this conclusion establishes. */
  factId: z.string().optional(),
  /** Prior nodes that must resolve before this question is even askable. */
  requires: z.array(z.string()).default([]),
  /** The ways to reach it — author ≥2 disjoint paths (three-clue rule). */
  supports: z.array(DeductionSupportSchema).default([]),
  /** How many supports resolve it. Default 1. */
  minSupports: z.number().int().positive().default(1),
  /**
   * When the question becomes an OPEN thread. Default: when `requires` all
   * resolve (root nodes with no requires open at case start).
   */
  opensWhen: ConditionSchema.optional(),
});
```

Added at the top level: `deductions: z.array(DeductionNodeSchema).default([])`.

### Resolution semantics (engine)

- A support is **satisfied** when: `evidenceId` ∈ `state.evidenceIds`;
  `knowledge` ∈ that character's `revealedBeatIds`; `nodeId` is itself resolved;
  or `condition` evaluates true.
- A node is **resolved** when every `requires` node is resolved **and** at least
  `minSupports` of its `supports` are satisfied.
- A node's question is an **open thread** when `opensWhen` is true (default: all
  `requires` resolved) and the node is not yet resolved.
- Nodes whose question has not opened are **invisible** — you cannot see a
  question you have been given no reason to ask (fog for inference).

### Branching (as you asked)

The **paths** branch; the **solution** does not. Multiple `supports` on one node
= redundant routes to the same conclusion (three-clue rule). A node with several
`requires` = convergence. Several nodes sharing one `requires` = divergence.
This expresses "this then that then that," multiple valid investigation orders,
and dead ends that still teach — all converging on the fixed terminal facts. A
branching *solution* would break fair play; a branching *path graph* to one
solution is exactly the goal.

### What it powers (all derived, none re-authored)

- **Threads (progress).** Open vs resolved questions = honest investigation
  shape ("3 leads open, 2 resolved") that never points at the culprit.
- **Readiness.** Terminal nodes (those with `factId`, facet taken from the
  rubric fact's `role`) the player has resolved → identity/method/motive
  readiness → the diegetic "your case would/wouldn't hold" signal. (Does
  **not** change accusation scoring; it is a preview. Node `role` is a
  fallback when `factId` is omitted.)
- **Fair-play audit.** The `clues` audit's reachability proof becomes a
  first-class check on real data: every terminal reachable via ≥2 disjoint
  support paths from turn 1.

### Referential integrity (superRefine additions)

Node ids unique; `requires`/`nodeId` reference existing nodes and form a DAG (no
cycles); `evidenceId` ∈ `evidence`; `knowledge` refs resolve; `factId` ∈
`rubric.requiredFacts` ids. Heavy reachability stays in the `clues` audit.

---

## 4. First-class items — additive enrichment (no rename)

Today `evidence[]` is the only "object," so keys, letters, and *observations*
("wheel marks in the glass dust") are all one flat list, and you "hold" marks in
dust. The genre really has two concepts — **items** you carry and **things you've
learned** — but because only Blackwood is being rewritten and the 9 legacy cases
must keep working (invariant 6), we express that distinction **without renaming
`evidence[]`**:

- **Inventory** renders the carriable `evidence[]` items (as today).
- **The Casebook** renders "what you've learned," **derived** from held evidence
  + what characters have told you (`revealedBeatIds`) + resolved deduction leads.
  No separate `clues[]` array to author — the split is a *projection*, not a
  schema change, so nothing legacy breaks.

`evidence[]` gains **optional affordances** so search/use/read/open are *modeled*
rather than fuzzy-matched. Every field is optional; an absent field behaves
exactly as today, so legacy cases are unaffected:

```ts
// enrich EvidenceItemSchema — all additive/optional
readable: z.object({ text: z.string() }).optional(),          // letter, ledger
usableOn: z.array(z.object({                                  // key→drawer, crowbar→crate
  targetId: z.string(),                                       // fixture/item/character id
  requires: ConditionSchema.optional(),
  outcome: z.array(EffectSchema).default([]),
})).default([]),
// (existing: discoverableAt, canPresentTo, redHerring)
```

**Fixtures** (today's `inspectables`) get real container/search affordances
instead of the single `objectId` escape hatch — again additive:

```ts
// enrich InspectableSchema — optional; absent = today's behavior
container: z.object({
  locked: z.boolean().default(false),
  unlockRequires: ConditionSchema.optional(),   // a key item, a flag
  contains: z.array(z.string()).default([]),     // evidence ids revealed on open/search
}).optional(),
```

> **Future option (not now).** A clean `items[]` / `clues[]` split is the
> long-term model, but it renames `evidence` and touches every `evidenceIds`
> path in the engine + all 9 legacy cases. Deferred until (if ever) every case
> migrates. For the Blackwood rewrite, enrich-in-place is enough — the Casebook
> gives us the "learning" surface without the rename.

---

## 5. First-class movement & location

Locations already carry exits, fixtures, presence, hazards, map coords, and
images. "First-class" here is about **meaning and robustness**, not more UI.

- **Access is part of the mystery.** Exits already gate on flags/evidence; make
  every gate *openable by play* (a key item, a pretext beat, earned trust, an
  escort) and make the gate itself informative — who keeps this locked, who else
  could get in. Access asymmetry is the opportunity map (MYSTERY_PRINCIPLES §8d).
- **Territory + schedule.** A character's `defaultLocationId` + time-gated
  `move_character` beats give each place an owner and an hour, multiplying scenes
  without adding map. The same library is new content when Vale is cornered in it
  at midnight.
- **A movement resolver owns travel.** One place decides: "go to X" = move;
  "have Bob come to me" / "call Bob" = summon or in-fiction refusal, **never**
  move the player; naming a person or object is never travel; far rooms need a
  path, not a fuzzy teleport (this is where the player-voice regressions lived).
- **The map is a reference, not a game surface.** Its whole job is to answer
  "what places exist, where am I, how do they connect" so the player never burns
  an AI turn asking — directly serving "it's hard to remember all the places."
  Fog of war stays: unknown rooms simply are not drawn. Click-to-travel is a
  reference convenience (it issues the normal engine move), not point-and-click
  play.

---

## 6. Derived, self-serve surfaces

Two reference surfaces, both silent, neither the AI.

### 6.1 Casebook (replaces the transient toast + thin notebook)

A persistent record, four sections, all derived from state the player
legitimately has:

- **Open leads** — questions from opened-unresolved deduction nodes.
- **Resolved** — questions the investigation has answered (marked closed; the
  answer is not restated — the player recalls it from play, so the Casebook
  never does the thinking for them).
- **Clues noted** — what you've learned, *derived* from held evidence + what
  people have told you + resolved leads (no separate clue list to author).
- **My notes** — the existing inert player scratchpad (never read by the engine).

Fair-play: open leads show *question* text only — never the supports needed to
close them (that would say where to look and what proves it).

### 6.2 Help checklist (the anti-stuck surface)

A **static, genre-universal** checklist the player opens when stuck — the thing
your tester lacked. Never AI, never case-specific, never a leak:

> Have you examined the crime scene? · Talked to everyone you've met? · Explored
> every location you know of? · Searched rooms for hidden things? · Looked for
> key items like a weapon? · Presented what you've found to the people involved?

Optionally, the genre-safe items may auto-check from *legitimate* state
("Explored every known location" ✓ when `visitedLocationIds ⊇ known`; "Talked to
everyone met" ✓ when each met character has `timesTalked > 0`). Leak-prone items
(did you find the weapon?) stay as un-checked prompts. This is the reconciliation
of "players don't know what to do" with "the AI must not coach": the *player*
consults a reference; the AI stays in character.

---

## 7. How it fits the platform/game split

The deduction graph, items, clues, and location/movement data are **declarative
data in the definition** — shared, versioned, and consumed by shared platform
libs (`computeProgress` → threads/readiness, the Casebook projection, the Help
auto-check, the `clues` audit). Case-specific *mechanics* (a breakable grip here
but not in the ward) still live in per-game module code. Data is shared; behavior
can diverge. This is consistent with GAME_ARCHITECTURE — `computeProgress` is
already earmarked as a `GameModule` seam.

---

**Scope: Blackwood Inheritance only.** No other case is touched. Because every
addition is optional (invariant 6), the other 9 keep parsing and playing on the
current model. Blackwood is already the first *owned game module*
(`blackwood-turn.ts`), so it is the natural home for the reference build.

1. **Land the schema** in `definition.ts`: `deductions`, optional `evidence`
   affordances, optional fixture `container` (+ superRefine integrity for the
   new refs). Additive — no `schemaVersion` bump required; confirm all 9 legacy
   cases still parse (`pnpm audits --no-llm` sweep).
2. **Engine derivation lib** (platform): support/node resolution, thread
   projection, readiness, Casebook projection, Help auto-check. Unit-tested,
   no LLM. Wire into `computeProgress` (a `GameModule` seam).
3. **Author Blackwood end-to-end** as the reference: build its deduction graph
   (terminals = its existing rubric facts; add the intermediate leads + ≥2
   support paths each), enrich a few key evidence items with affordances, and
   verify the derived threads/readiness read correctly and the graph passes the
   reachability audit. Run `pnpm storycheck --case blackwood-inheritance`.
4. **UI**: Casebook drawer + Help drawer (reference surfaces); retire the
   transient-only toast; keep Inventory/Cast meter-free.
5. **Update PLAYER_SURFACES §4** to record what is now IN (questions/threads,
   earned facts, coarse readiness, static Help) vs. still OUT
   (solution-correctness bars, clue-importance badges, point-and-click, AI
   coaching).

Only when we later decide to migrate the whole library do the other cases get
authored onto the graph (and only then is the `items[]`/`clues[]` rename worth
considering).

## 9. What we are explicitly NOT building

- No point-and-click / hotspot play. The player types.
- No AI nudging, coaching, or breaking character to help.
- No progress bar to the *solution*; no clue-importance markers on items or
  people; no willingness/trust meters.
- No branching *solutions* — only branching *paths* to one fixed solution.
