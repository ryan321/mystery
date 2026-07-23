# Creating mysteries for this platform

**Status:** Authoring guide (v1)  
**Date:** 2026-07-23

How to invent and structure a new mystery for MysteryTrove. This is the
process we use so cases are **fair, solvable, and fun** — not just atmospheric
chat with a secret ending.

Ignore older authoring notes for now; treat this document as the spine.

---

## What you are building

A mystery on this platform is **not** freeform AI improvisation of a culprit.
It is:

1. **Fixed truth** — who / how / why (sealed; the engine scores against it).
2. **A path the player can actually walk** — evidence and testimony that
   support a chain of inferences (the **solution graph**).
3. **A living world the AI performs** — places, people, tone — *inside* the
   bounds of that truth and path.

The AI portrays the world and the people. It does not invent the solution.
The engine owns state, discovery, and judgment. The player types freeform
actions; reference surfaces (map, cast, inventory, casebook) hold ambient
knowledge so they are not stuck guessing verbs.

**The final pleasure is not learning who did it.** It is seeing through a
deception that once controlled everyone else.

---

## Promise the crime (especially if play starts before it)

Many strong cases **do not open on a body**. The player arrives at a dinner,
weekend, voyage, or ordinary evening; the disturbance lands **during** play.
That depth only works if the player knows they are in a **mystery**, not a
social sim with no payoff.

**Rule: the mystery description must make clear that a crime (or central
disturbance) WILL take place.** Do not hide that this is a whodunit to
“preserve surprise.” The surprise is *who / how / why / the trick* — not
*whether* something terrible happens.

### Where the promise lives

| Surface | What to say |
|---|---|
| **Store / case card** (`meta.premise`, `summary`, `theMystery`) | Explicit: someone will die / a crime will shatter the evening / you will have to solve what happens under this roof |
| **Title & tags** | Signal genre (murder, mystery, closed circle) |
| **Opening package / dossier** | You are here for a dinner (etc.); by night’s end the house will not be the same; pay attention |
| **Opening narration** | Tone of impending break — without naming the culprit or method |

### Good vs bad

| Weak (player freezes or gets bored) | Strong (player pays attention) |
|---|---|
| “A charming dinner at Ashford Hall.” | “A charming dinner at Ashford Hall — before the night is out, murder will sit at the table, and you will be the one who has to name the truth.” |
| “Meet interesting guests.” | “Meet them carefully. One of them will cross a line no one can take back.” |
| Implied mystery only by product brand | Stated in **this** case’s description |

### What you are *not* spoiling

You may promise **that** a crime happens. You still seal:

- who did it  
- who was meant to die (if wrong-target)  
- method and motive  
- the second turn of the plot  

Players who know “a murder is coming” watch place cards, pours, and nerves.
Players who don’t know may type “hello” for ten turns and leave.

### Pre-crime play still needs a job

Promising the crime is necessary but not sufficient. Also give:

- a light **persona** and **task** at arrival (why you’re invited)  
- a **short** runway to the disturbance (authored beat/clock — crime is guaranteed)  
- rooms and people that imply verbs (talk, look, note the table)

---

## The order that works

Do **not** start with a full map, cast bios, or prose. Start with the crime
and the path to the answer.

```
1. Disturbance (what broke, and why it matters)
2. Sealed truth (who / how / why)
3. False appearance (what it looks like at first)
4. Solution graph (how the player figures it out)
5. Only then: world, people, items, knowledge, beats, voice
```

If the graph is solid, cast and rooms mostly **fall out of the supports**
(the leaves of the graph). If you build the world first, you get flavor that
never feeds a fair path — then players and the AI both thrash.

---

## Step 1 — The disturbance (the “crime”)

Name what actually went wrong. “Crime” can be murder, theft, sabotage,
disappearance, fraud, a missing object — scale matters less than **human
weight**.

Answer:

- What was violated? (life, trust, inheritance, safety, reputation, a plan)
- Who is hurting if the truth stays hidden?
- Why does solving it matter beyond a quiz answer?

One or two sentences is enough at this stage. Example:

> On a storm-bound night, the master of the house dies at the foot of the
> stairs. The family and fortune hang on whether it was accident, outsider,
> or someone already under the roof.

---

## Step 2 — The sealed solution

Write the fixed truth the game will never improvise away:

| Facet | Content |
|---|---|
| **Identity** | Who is responsible (ids/names the rubric will match) |
| **Method** | How it was done (enough for a fair accusation) |
| **Motive** | Why (enough for a fair accusation) |
| **Summary** | A short sealed paragraph for authors / endings |

This becomes `solution` + rubric facts later. Players may accuse cold (without
full evidence); the graph is for **guidance and fair design**, not a gate that
blocks guessing.

---

## Step 3 — The false appearance (the trick)

A pure crime + answer list is a quiz. A good mystery is a **magic trick**:

> What appears to have happened, and why that almost works.

Sketch:

- The story the first clues *seem* to tell (break-in, accident, the wrong
  person, the wrong time).
- What makes that story incomplete or contradictory once you look closer.
- At least one clue that **does double duty** — it supports the false story
  early and the true story later when re-read with new context.

Without this, the graph tends to be a linear checklist. With it, early
discoveries **widen** questions and late ones **narrow** them.

---

## Step 4 — The solution graph (the keystone)

The solution graph is the authoring artifact for **how the player can figure
it out**. It is sealed (never sent to the AI as “here is the answer”). Only
player-facing **open questions** and coarse readiness surface in the
casebook.

### Shape

- **Terminal nodes** — establish identity, method, and/or motive (tie to
  rubric facts via `factId` when you encode).
- **Intermediate leads** — the “this, then this” questions (e.g. “How did
  they get in?” → “Who arranged the scene?”).
- **Supports** — how a node becomes resolvable:
  - held / noted evidence (`evidenceId`)
  - a character disclosed a knowledge beat (`knowledge`)
  - a prior deduction (`nodeId`)
  - rarely, an engine condition
- **Requires** — prior nodes that must resolve before this question is even
  askable (fog for inference: you don’t see a question you have no reason
  to ask yet).
- **minSupports** — how many supports must land (default 1; use 2+ when you
  want stronger proof).

### Rules that keep cases fair and fun

1. **≥2 disjoint paths** to each terminal (or to the critical intermediate
   that unlocks them). One clue = fragile and easy to miss; two independent
   routes = fair.
2. **Paths branch; the solution does not.** Multiple supports = redundant
   routes to the same truth. Several requires = convergence. Never branch
   into alternate culprits as “valid endings” unless the product explicitly
   wants that (default: one sealed truth).
3. **Leaves must be learnable in play** — findable items, sayable testimony,
   visit-able places. No “the player just knows.”
4. **Red herrings are allowed** as items/people, but they must not be the
   only path to a terminal.
5. **The graph guides; it never gates winning.** Cold correct accusations
   still score. The graph powers casebook threads, readiness (“your case
   would hold”), and design audits.

### Minimal graph sketch (before any JSON)

For each node, write a line like:

```
id: entry-staged
claim: (sealed) The entry was faked from inside
question: How did the intruder get in?
requires: (none | other node ids)
supports:
  - evidence: muddy-print-odd
  - evidence: window-latched-inside
  - testimony: henshaw / who-was-home
minSupports: 1
→ feeds: method-node, identity-node
```

Do **not** show `claim` to the player. Only `question` becomes an open lead.

Aim for roughly:

- 3–8 intermediate leads for a short case  
- Identity / method / motive terminals (or fewer if the case is “how did a
  known person do the impossible”)  
- Every terminal reachable by ≥2 independent support routes from play start  

---

## Step 5 — World that serves the graph

Only after the graph sketch, flesh:

| Need | Pull from the graph |
|---|---|
| **People** | Who can testify? Who lies? Who is the false suspect? |
| **Places** | Where are supports found? What access is asymmetric? |
| **Items** | Carriable evidence; readable letters; keys that open fixtures |
| **Knowledge beats** | What each person will say only when conditions allow |
| **Opening** | What the player already knows (persona + false appearance) |

Prefer **one clear model** for objects:

- Fixtures that contain things (`container` / search)  
- Items you hold, read, present, or use on a target  
- Observations you “learn” show up in the casebook as held items +
  disclosed testimony + resolved leads — not a second secret list  

Locations should make **access meaningful** (who has keys, who could enter)
when the method depends on it. Territory and schedule multiply scenes without
adding rooms: the same library is different content at midnight with the
right person cornered.

---

## Step 6 — Dynamics (after the path is fair)

Once the path exists:

- **Beats** — plot reactions (someone flees, a door unlocks, trust shifts)
  when the player has certain evidence or talks to someone.
- **Clocks / failure** — time pressure, retaliation, escape — authored
  endings, not silent soft-locks.
- **Denouement** — aftermath after judgment; return-to-normal when it fits.
- **Game module** (code) — voice, pacing hooks, case-only rules when the
  shared turn is not enough. Prefer `standardTurn` + guidance/hooks over
  forking the whole pipeline. Write as much game code as **quality** needs;
  never reimplement sealing or closed-world checks.

---

## Platform shape (only what authors need)

```
Platform  — fairness, state, AI plumbing, standard turn helper
Game      — this mystery’s voice / pacing / special rules (optional module)
Content   — definition: world, knowledge, deductions, solution, endings
Surfaces  — map, cast, inventory, casebook (ambient free; discoveries earned)
```

Player turn:

```
free text → Director (intents) → Engine (rules) → Performer (prose)
```

The AI never coaches (“you should search the desk”). Affordances live in
narration and in static reference UI (casebook questions, help checklist).

---

## Encoding checklist (when you write the definition)

Use this only after the prose sketch of crime / truth / false story / graph
is done.

- [ ] `solution.summary`, `guiltyPartyIds`, method/motive text as needed  
- [ ] `solution.rubric.requiredFacts` with roles + matchHints  
- [ ] `deductions[]` — terminals with `factId`; leads with `question` only
      for player text; `supports` ≥2 where fairness demands; DAG (no cycles)  
- [ ] Evidence / knowledge / locations referenced by supports all exist  
- [ ] Opening package: premise + what the persona already knows  
- [ ] Endings: success + at least one failure path you care about  
- [ ] Optional game module: register voice/hooks if default tone is wrong  

---

## Anti-patterns

| Don’t | Do |
|---|---|
| Build a huge map first | Build graph leaves, then rooms that hold them |
| One clue → one conclusion only | Dual paths to terminals |
| Branching culprits as “valid” | Branching *investigation* paths to one truth |
| Hide the only proof off-map | Every support learnable in play |
| AI as coach or co-author of truth | AI as performer inside sealed truth |
| Solution graph as a win gate | Graph as casebook + design discipline |
| Author secrets into player UI | Only questions, earned labels, coarse readiness |

---

## One-page template (copy for a new case)

```markdown
## Working title

## Disturbance
-

## Stakes (if unsolved)
-

## Sealed solution
- Identity:
- Method:
- Motive:
- Summary:

## False appearance (opening lie)
-

## Solution graph

### Lead: (id)
- Question: (player-facing)
- Claim: (sealed)
- Requires:
- Supports: (2+)
- Feeds:

### Terminal: identity / method / motive
- factId:
- Question:
- Requires:
- Supports: (2+)

## Cast sketch (only as graph needs)
-

## Place sketch
-

## Key items
-

## Opening knowledge (player persona)
-
```

Fill the template top to bottom. Stop when every terminal has two real paths.
Then open the definition and game module.

---

## Bottom line

**Crime → sealed solution → false appearance → solution graph → world.**

That order is how this platform stays fair at library scale and how players
get the feeling of solving something, not the feeling of prompting a chat
bot until it confesses.
