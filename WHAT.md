# What is Mystery?

**Status:** Product definition (v0)  
**Updated:** 2026-07-17

---

## One sentence

**Mystery** is a **single-player, text-based investigation game platform**: each title is a structured **Mystery Definition** with a fixed solution; the AI **runs** play from the player character’s point of view — it does not invent the case at runtime.

---

## What this product is

| Aspect | Decision |
|--------|----------|
| Players | **Single-player** only (v1 and core identity) |
| Perspective | **Second person / player persona** — you play *as* a character (often a detective, but not required: Nancy Drew, Hardy Boys, Encyclopedia Brown, journalist, kid sleuth, etc.) |
| Medium (v1) | **Text** — move, look, talk, inspect, take; no required graphics |
| Case source | **Authored Mystery Definitions** (hand-written or produced offline with AI tools). **The platform does not generate mysteries during play or as a product feature.** |
| AI’s job | **Run the game** — portray characters, describe places, react to actions, respect state and secrets |
| Win condition | Player **solves the mystery**; game **ends** with a coherent ending driven by the authored solution + play state |

---

## What a “Mystery” is (required structure)

A mystery is not a freeform prompt. It is a **definition**: structured data the runtime loads and enforces.

At minimum a Mystery Definition includes:

### 1. Meta
- Title, premise / briefing
- Tone, setting, estimated length
- Content notes as needed

### 2. Player persona
- Who the player *is* in this case (name, role, voice constraints)
- What they already know at start
- Starting location
- Starting inventory (if any)

The persona is part of the case (Encyclopedia Brown vs hardboiled PI changes framing), not a global account cosplay layer for v1.

### 3. World
- Locations the player can **move** between (text graph: rooms / sites / areas)
- What is visible on arrival vs requires **inspect** / search
- Connections (exits, locked paths, conditions to enter)

### 4. Characters
- Who exists in the world and where they can be found (fixed and/or by state)
- Public face vs **private knowledge** (they usually know more than they say)
- Secrets, motives, alibis, relationships
- What they will lie about, deflect, or only reveal under conditions
- **Dialogue memory**: the runtime must persist what this character has already said *to this player* in this playthrough (and ideally what the player told them), so they stay consistent

### 5. Objects & inventory
- Items that can be found, inspected, taken
- Player **inventory** of obtained items
- What items unlock (dialogue, locations, inspections, accusations)

### 6. Solution
- The fixed truth: who / what / how / why (as required by the case design)
- What counts as “solved” (rubric: required discoveries, correct accusation, etc.)
- Ending material: resolution text / epilogue logic that **makes sense** given the solution and how the player arrived

### 7. State model
- Flags, phases, clocks, known-facts — whatever the case needs so the game can run **according to progress**
- Examples: clue found, suspect confronted with evidence X, location unlocked, phase “police close the pier”
- State gates character availability, dialogue openness, world changes, and ending branch

### 8. Endings
- At least one **solved** ending when win conditions are met
- Optional wrong-accusation / partial / fail endings if the definition supports them
- Ending must be coherent with the **authored solution** and current **state** — not improvised contradictory lore

---

## What the player can do (v1 verbs)

Core interaction set:

| Verb | Meaning |
|------|---------|
| **Move** | Travel between locations in the world graph |
| **Look / inspect** | Examine place, object, or detail; may reveal clues or items |
| **Talk** | Freeform conversation with a character present (or reachable) |
| **Take / use** (as needed) | Obtain items into inventory; use/present items when the definition allows |
| **Inventory** | Review what the player has obtained |
| **Notebook** (recommended) | Track clues / notes (auto and/or manual) — strongly fits the genre even if thin in v1 |
| **Solve / accuse** | Submit the solution attempt; triggers evaluation against the definition |

Freeform **talk** is AI-driven.  
**World movement, inventory, solution check, and most discovery rules** are engine-driven so the case stays fair and stateful.

---

## What the AI does vs what the engine does

```
┌─────────────────────────────────────────────────────────┐
│                 Mystery Definition (authored)           │
│  world · cast · secrets · items · solution · state rules│
└────────────────────────────┬────────────────────────────┘
                             │ load
                             ▼
┌─────────────────────────────────────────────────────────┐
│                      Game engine                        │
│  location · inventory · flags · memory store · win check│
│  what each character is allowed to know right now       │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
                ▼                     ▼
        AI portrays NPCs      AI describes place/action
        (in-character,        flavor within engine facts
         no free invention
         of the solution)
```

| Engine owns | AI owns |
|-------------|---------|
| Current location, map legality | Natural language of replies and descriptions |
| Inventory contents | Character voice and manner |
| State flags / phase | How a secret is *phrased* when release rules allow |
| What each character may know | Consistency of tone |
| Win / lose / end trigger | Epilogue prose *from* authored ending material |
| Persistence of dialogue memory records | Rendering memory into coherent dialogue |

**Non-negotiable:** the AI does not get to rewrite who did it, invent the real killer mid-run, or “helpfully” complete the solution because the player jailbroke a prompt.

---

## What the platform does *not* do

- **Does not** generate mystery definitions as a product feature (authors or offline AI tools may create definitions; the live platform *runs* them)
- **Does not** multiplayer / shared cases in v1
- **Does not** open-world endless simulation outside the definition
- **Does not** treat the product as a general AI RPG or fantasy sandbox
- **Does not** leave “the ending” purely to model whim — endings are definition-backed

---

## Playthrough lifecycle

1. **Load** Mystery Definition  
2. **Start** — player persona, briefing, starting location & inventory  
3. **Play loop** — move, inspect, talk, manage inventory; state and NPC memory update  
4. **Solve attempt** — player commits to a solution (accusation / explanation per case rules)  
5. **Evaluate** against authored solution + required state  
6. **End** — coherent ending; case complete (success, partial, or failure if defined)

A playthrough is a **saved state**: location, inventory, flags, per-character dialogue history, notebook.

---

## Character knowledge model (critical)

Characters are not chatbots with the full case file.

For each character, the definition separates roughly:

- **Public** — safe to discuss freely  
- **Private** — known but withheld until conditions (pressure, evidence, trust, state flags)  
- **Secret / complicit** — tightly gated  
- **Unknown** — truly not known; they must not invent facts that only the solution holds  

They **remember** prior exchanges with the player in this run so they cannot casually contradict themselves without reason (e.g. caught in a lie may become a state change).

---

## Success criteria for “good”

A build is on-mission when:

1. A player can finish a case without the AI spoiling or rewriting the solution.  
2. Moving, inspecting, inventory, and talking all feel like one coherent investigation.  
3. NPCs know more than they say, and memory makes them feel continuous.  
4. Solving produces an ending that matches the authored truth and the state of play.  
5. A second Mystery Definition can be dropped in without changing the engine.

---

## Phased product shape

| Phase | What ships |
|-------|------------|
| **v1** | Engine + definition format + 1–N handcrafted cases + single-player text play + save state + solve/end |
| **Later** | Better authoring tools, community publishing of definitions, richer UI, optional co-op — **not** required to define the product |

---

## Working principle

> **The Mystery Definition owns the truth and the rules.  
> The engine owns state, inventory, memory, and endings.  
> The AI performs the world and the people inside those bounds.  
> The player is a character inside the case, not a prompt engineer outside it.**

---

## Open details (not blocking the “what”)

- Exact schema format (JSON/YAML) for definitions  
- How strict “solve” is (form fields vs free text judged by rubric)  
- How much notebook is automatic vs manual  
- Fail/partial endings policy per case  
- Name/branding  

These refine implementation; they do not change what the product *is*.
