# Case Definition Model

**Status:** Design target (v2 direction)  
**Date:** 2026-07-18  
**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md), [WHAT.md](../WHAT.md)

A **case definition** is the authored mystery kit: sealed truth, world, people, objects, and the **dynamic investigation plot** (unlocks, reactions, developments). The AI performs inside the current state; it does not invent the culprit or the major plot graph.

---

## 1. Design goals

1. **Fair play** — solution and unreleased secrets never drive freeform narration.
2. **Closed world** — only defined places, people, objects, exits exist.
3. **Dynamic story** — like a novel: discoveries chain, people change, the house changes, events fire.
4. **Entity / world state** — not only a global bag of flags: **game**, **character**, **object**, **location**, **environment**, and **time** state (and later **relationship**).
5. **Engine authority** — conditions/effects are evaluated in code; AI narrates and fills texture.
6. **Testable** — “if player has key, door unlocks; if letter presented to Henshaw, Vale’s stance shifts” is unit-testable.

---

## 2. Four layers of content

| Layer | Role | Exposed to narrator AI? |
|-------|------|-------------------------|
| **Canon** | Fixed past: timeline of the crime, true culprit, method, motive | **No** (except ending evaluator) |
| **World** | Map, objects, who can be where, inspect rules | **Yes** (projected, filtered by state) |
| **State model** | What can change: game, character, object, location, environment, time | Runtime instance; definition declares defaults + schema |
| **Plot graph** | Beats, conditions, effects — investigation dynamics | AI sees **results** + `justHappened`, not full sealed graph |

---

## 3. State slices (core insight)

A mystery is not only “global flags.” The investigation world has **slices of state** that evolve independently and together.

**Six primary slices:**

| Slice | What it is |
|-------|------------|
| **Game** | Investigation meta (phase, beats fired, case status) |
| **Character** | Each person (location, willingness, pressure…) |
| **Object** | Each item/container (locked, taken, destroyed…) |
| **Location** | Each place (accessible, exits, description…) |
| **Environment** | Shared atmosphere and ambient conditions (weather, crowds, wildlife, light…) |
| **Time** | In-fiction clock and schedule (hour grows late; dinner ends; midnight) |

### 3.1 Game state (playthrough-global)

Belongs to the run as a whole — *meta* of the investigation, not the weather or the hour.

| Examples | Purpose |
|----------|---------|
| `phase` | arrival / deepening / crisis / confrontation |
| `turnCount` | player actions taken (pacing; may couple to time) |
| `clocks` | countdown timers (“police in 5 turns”) — distinct from **story time of day** |
| `firedBeatIds` | which plot beats already happened |
| `status` | active / solved / failed |
| abstract facts | e.g. `body_moved` (if not modeled as object/location) |

> **Note:** Prefer **environment** for weather/atmosphere and **time** for hour-of-day / schedule. Keep `game` for plot bookkeeping.

### 3.2 Character state (per character, per run)

Belongs to each person in *this* investigation.

| Field (illustrative) | Examples |
|----------------------|----------|
| `locationId` | Where they are *now* (may differ from default) |
| `present` / available | In house vs fled vs locked in room |
| `willingness` | `open` → `guarded` → `hostile` → `silent` / `fled` |
| `pressure` | 0–N; rises when cornered with evidence |
| `trust` | optional opposite of pressure |
| `alibiStatus` | `claimed` / `broken` / `abandoned` |
| `stance` | short tag for AI: `helpful`, `defensive`, `panicked` |
| `revealedKnowledgeIds` | which of *their* beats they’ve let out |
| `timesTalked` | bookkeeping for conditions |
| `flags` | character-local booleans if needed |

**Novel moment:** Henshaw is willing to talk at first (`willingness: open`). After you falsely accuse him or humiliate him in front of Mrs. Blackwood, beat fires → `willingness: silent`. The AI is told “Henshaw will not engage productively” — engine enforces (e.g. block useful reveals; optional hard reject of “he spills everything”).

### 3.3 Object / evidence state (per object, per run)

Belongs to each defined object or evidence item.

| Field | Examples |
|-------|----------|
| `stage` | `hidden` / `visible` / `examined` / `taken` / `destroyed` / `given_away` |
| `locationId` | Where it is if not in inventory |
| `locked` | container still locked |
| `ownerId` | whose possession (optional) |
| `knownToPlayer` | player has seen it exists |
| `flags` | object-local |

**Novel moment:** Desk drawer starts `locked: true`. Player obtains brass key → beat or effect sets drawer `locked: false` and/or inspectable becomes available. Letter moves `stage: taken` into inventory.

Evidence in inventory is still “object state” with `stage: taken` and implicit `holder: player`.

### 3.4 Location state (per place, per run)

Belongs to each room/area.

| Field | Examples |
|-------|----------|
| `accessible` | can the player enter? |
| `known` | on map / fog of war |
| `descriptionOverride` or `descriptionAppend` | room changed after event |
| `exitOverrides` | which exits open/closed *now* |
| `tags` | `crime_scene`, `dark`, `searched` |
| `flags` | location-local |

**Novel moment:** East wing door starts locked (`exit requires object state key OR location exit locked`). After key + unlock action/beat, exit opens. Or after a fire beat, library `descriptionAppend`: “Smoke stains the ceiling; the ledger is half-burned.”

### 3.5 Environment state (shared atmosphere / ambient conditions)

Belongs to the **shared setting**, not a single room or person — though it may *affect* rooms and people.

| Field (illustrative) | Examples |
|----------------------|----------|
| `weather` | `clear` / `rain` / `storm` / `fog` / `snow` |
| `weatherIntensity` | light → severe |
| `light` | `day` / `dusk` / `night` / `blackout` (can sync with time) |
| `ambient` | tags or enums: `quiet`, `tense`, `festive` |
| `crowd` | `none` / `gathering` / `crowd` / `dispersing` — e.g. onlookers at the pier |
| `wildlife` / `nature` | `birds_flock`, `dogs_barking`, `silence` — sudden flock as omen or distraction |
| `soundscape` | `distant_sirens`, `party_music`, `thunder` |
| `visibility` | fog reduces what inspectables notice without a flag |
| `flags` | case-specific ambient booleans |

**Novel / game moments:**

- Storm worsens after a beat → environment `weather: storm`; AI describes rain harder; optional: some outdoor exits dangerous.  
- “A crowd gathers on the dock” → `crowd: gathering`; new ambient pressure; maybe a witness appears (character move + beat).  
- Birds suddenly flock from the east wing → one-shot environment pulse + story beat (`narrationHints`) + maybe unlock “something startled them in the garden.”  

Environment is **global by default**, but effects can be **scoped** later (`environment.local[locationId]`) if a single room is smoky while the rest of the house is fine. Start global; add local only when needed.

**Environment vs location:**

| Use **environment** | Use **location** |
|---------------------|------------------|
| Weather, time-of-day light, whole-estate mood | This room is burned / locked / searched |
| Crowd at the estate, flock of birds | “Library description append” |
| Sirens approaching the grounds | Exit from hall to library open |

### 3.6 Time state (in-fiction clock and schedule)

Time is its own slice because mysteries care about **when** things happen — both in the sealed crime and during the investigation.

#### Two different “clocks” (do not conflate)

| Clock | What it measures | Example |
|-------|------------------|---------|
| **Story time** | In-fiction hour / slot on the case’s calendar | 9:00 PM → 10:00 PM → midnight; “dinner ends” |
| **Turn count** | Number of player actions | 1st message, 2nd message… |
| **Countdown clocks** | Turns until an event (game state) | “Police arrive in 5 turns” |

*Colonel’s Bequest*-style: **finding or doing something advances story time** (discovery → time jumps).  
Also needed: **time can march on** even without a big discovery — the hour grows late, dinner ends, the clock strikes twelve.

#### Story time model (recommended)

```ts
TimeState {
  // Discrete is easier to author than continuous minutes
  slotId: string              // e.g. "evening_arrival" | "after_dinner" | "approaching_midnight" | "midnight"
  // Optional numeric for comparisons
  minutesFromStart: number    // 0, 30, 60… authored scale
  dayIndex?: number           // multi-day cases later
}
```

Definition declares an ordered **schedule** (slots):

```ts
timeSchedule: [
  { id: "guests_arrive", label: "Early evening", minutesFromStart: 0 },
  { id: "dinner", label: "Dinner", minutesFromStart: 60 },
  { id: "after_dinner", label: "After dinner", minutesFromStart: 120 },
  { id: "late", label: "Late evening", minutesFromStart: 180 },
  { id: "midnight", label: "Midnight", minutesFromStart: 240 },
  { id: "after_midnight", label: "After midnight", minutesFromStart: 300 }
]
```

#### How time advances (three mechanisms)

**A. Unlock / discovery advance (Colonel’s Bequest style)**  
A story beat or inspect effect includes:

```ts
{ type: "advance_time", toSlotId: "after_dinner" }
// or
{ type: "advance_time", byMinutes: 30 }
```

When you find the will / body / letter, the evening **jumps forward**. That gates “characters have left the dining room,” “servants cleared plates,” etc.

**B. Passive / background march**  
On each player turn (or every N turns), engine applies:

```ts
time.minutesFromStart += definition.time.minutesPerTurn  // e.g. 5–15
// recompute slotId from schedule
```

So even if the player only chats, **it gets late**. Dinner eventually ends because a beat says:

```ts
when: { type: "time_at_least", slotId: "after_dinner" }
effects: [
  { type: "set_phase", phaseId: "deepening" },
  { type: "move_character", characterId: "clara", toLocationId: "hallway" },
  { type: "set_environment", weather: "storm" }  // optional coupling
]
```

**C. Scheduled events (the clock strikes 12)**  
Beats keyed purely on time:

```ts
{
  id: "midnight_strikes",
  once: true,
  trigger: "on_turn",
  when: { type: "time_reached", slotId: "midnight" },
  effects: [
    { type: "set_environment", light: "night", ambient: "ominous" },
    { type: "queue_beat", beatId: "something_in_the_gallery" }
  ],
  narrationHints: "The great clock finishes twelve. Something in the house answers."
}
```

Similarly: `dinner_ends`, `guests_retire`, `power_flickers_at_late`.

#### Coupling time → other state

Time almost never acts alone. Authors chain:

| Time | Typical effects |
|------|-----------------|
| Dinner ends | Move cast out of dining room; willingness changes; new locations accessible |
| Midnight | Environment light/night; optional crisis beat; outdoor visibility drops |
| Storm peaks at “late” | Environment weather; some exits dangerous or blocked |
| Morning (if multi-slot) | Constables arrive; crowd gathers |

#### Player-facing time

- Optional UI: “Saturday, 11:40 PM” or soft label “Late evening”  
- AI always gets current `time.label` + environment in ContextPack  
- Don’t require the player to manage a clock UI for v1 — narration carries it  

### 3.7 Why not “only global flags”?

You *can* encode everything as `henshaw_silent`, `drawer_unlocked`, `library_burned`, `weather_storm`, `time_midnight`. It works until it doesn’t:

- Authors lose the mental model  
- Conditions become unreadable  
- Easy to forget symmetric updates  
- Harder to project clean ContextPacks (“all character state for people here”)

**Global/game flags remain** for abstract plot facts. **Typed state slices** for things that *are* entities or shared world dimensions.

**Rule of thumb:**

| About… | Put it in… |
|---------|------------|
| Person’s attitude / position | **character** state |
| Item / container | **object** state |
| Room / exit | **location** state |
| Weather, crowd, wildlife, estate-wide mood | **environment** state |
| Hour of night, schedule, “dinner ended” | **time** state |
| Investigation bookkeeping, phase, beat ids | **game** state / beats |

---

## 4. Static definition vs runtime instance

| In definition (authored) | At runtime (playthrough) |
|--------------------------|---------------------------|
| Default character location, default willingness | `characterState[id]` |
| Object starts locked / hidden | `objectState[id]` |
| Exit locked until condition | `locationState[id].exits` or evaluate live from defaults + overrides |
| Default weather / ambient | `environmentState` |
| Starting time slot + schedule | `timeState` + march rules |
| Story beats, conditions, effects | `firedBeatIds`, queues, countdown clocks |
| Canon solution | never copied into narrator pack |

Initialization: copy defaults from definition into playthrough state maps.

---

## 5. Plot graph: story beats + conditions + effects

### 5.1 Conditions (shared language)

Used by beats, knowledge, exits, inspectables, presence.

```ts
Condition =
  | { type: "always" }
  | { type: "never" }
  // Game
  | { type: "phase_is", phaseId: string }
  | { type: "turn_at_least", n: number }
  | { type: "game_flag", id: string, equals: FlagValue }
  | { type: "beat_fired", beatId: string }
  | { type: "clock_expired", clockId: string }  // countdown timer, not story-time
  // Time (story clock)
  | { type: "time_slot_is", slotId: string }
  | { type: "time_at_least", slotId: string }   // current slot >= this in schedule order
  | { type: "time_reached", slotId: string }    // exactly transitioned onto this slot (edge)
  | { type: "time_minutes_at_least", n: number }
  // Environment
  | { type: "weather_is", weather: string }
  | { type: "environment_flag", id: string, equals: FlagValue }
  | { type: "crowd_is", level: string }
  | { type: "light_is", light: string }
  // Player progress
  | { type: "has_evidence", evidenceId: string }
  | { type: "visited", locationId: string }
  | { type: "presented", evidenceId: string, toCharacterId: string }
  | { type: "talked_to", characterId: string, minTimes?: number }
  // Entity state
  | { type: "character_willingness", characterId: string, is: Willingness }
  | { type: "character_pressure_at_least", characterId: string, value: number }
  | { type: "character_at", characterId: string, locationId: string }
  | { type: "object_stage", objectId: string, is: ObjectStage }
  | { type: "object_unlocked", objectId: string }  // locked === false
  | { type: "location_accessible", locationId: string }
  | { type: "exit_open", from: string, to: string }
  // Boolean
  | { type: "and", of: Condition[] }
  | { type: "or", of: Condition[] }
  | { type: "not", of: Condition }
```

### 5.2 Effects (mutations)

```ts
Effect =
  // Game
  | { type: "set_game_flag", id: string, value: FlagValue }
  | { type: "set_phase", phaseId: string }
  | { type: "start_clock", clockId: string, turns: number }
  | { type: "queue_beat", beatId: string, delayTurns?: number }
  | { type: "end_case", outcome: "success" | "partial" | "failure" }
  // Time
  | { type: "advance_time", toSlotId: string }           // jump (Colonel’s Bequest-style unlock)
  | { type: "advance_time", byMinutes: number }          // relative jump
  | { type: "set_time_minutes", minutesFromStart: number }
  // Environment
  | { type: "set_weather", weather: string, intensity?: string }
  | { type: "set_light", light: string }
  | { type: "set_crowd", level: string }
  | { type: "set_ambient", ambient: string }
  | { type: "set_environment_flag", id: string, value: FlagValue }
  | { type: "pulse_environment", tag: string }           // one-shot: birds flock, thunder crack
  // Character
  | { type: "set_willingness", characterId: string, value: Willingness }
  | { type: "set_stance", characterId: string, value: string }
  | { type: "add_pressure", characterId: string, by: number }
  | { type: "move_character", characterId: string, toLocationId: string }
  | { type: "set_character_available", characterId: string, value: boolean }
  | { type: "reveal_knowledge", characterId: string, knowledgeId: string }
  | { type: "set_alibi_status", characterId: string, value: AlibiStatus }
  // Object
  | { type: "set_object_stage", objectId: string, value: ObjectStage }
  | { type: "set_object_locked", objectId: string, value: boolean }
  | { type: "move_object", objectId: string, to: "inventory" | { locationId: string } }
  | { type: "grant_evidence", evidenceId: string } // player inventory convenience
  // Location
  | { type: "set_location_accessible", locationId: string, value: boolean }
  | { type: "set_exit_open", from: string, to: string, value: boolean }
  | { type: "append_location_description", locationId: string, text: string }
```

### 5.3 Story beat

```ts
StoryBeat {
  id: string
  title?: string
  once: boolean              // default true
  trigger: "on_turn" | "on_discover" | "on_present" | "on_talk" | "on_phase_enter" | "manual"
  when: Condition
  effects: Effect[]
  // AI performance guidance when this fires
  narrationHints?: string
  reactions?: { characterId: string, lineHint?: string, stance?: string }[]
}
```

### 5.4 Chain example (key → door → room → person changes)

**Definition defaults**

- Location `east-wing` accessible: false (or exit hall→east-wing open: false)  
- Object `brass-key` stage: hidden in library ash  
- Object `east-wing-door` locked: true  
- Character `clara` at `bedroom`, willingness: `guarded`

**Beats / effects**

1. Player examines ash → grant `brass-key`, object stage `taken`.  
2. Player uses key on door (inspect/use) **or** beat `unlock_east_wing` when `has_evidence(brass-key)` and player at door:  
   - `set_object_locked(east-wing-door, false)`  
   - `set_exit_open(entrance-hall, east-wing, true)`  
   - `set_location_accessible(east-wing, true)`  
3. First enter east-wing → beat `clara_hears_you`:  
   - `set_willingness(clara, open)`  
   - narrationHints: she appears in the corridor, finally willing to talk  
4. If player later accuses Clara wrongly → beat `clara_shuts_down`:  
   - `set_willingness(clara, silent)`  

That is novel-like progression with **object state**, **location state**, and **character state** collaborating.

### 5.5 Character shuts down (your example)

```ts
{
  id: "henshaw_refuses_after_accusation",
  once: true,
  trigger: "on_turn",
  when: {
    type: "or",
    of: [
      { type: "game_flag", id: "falsely_accused_henshaw", equals: true },
      { type: "and", of: [
        { type: "presented", evidenceId: "weak-theory", toCharacterId: "henshaw" }
        // or: beat_fired / pressure path
      ]}
    ]
  },
  effects: [
    { type: "set_willingness", characterId: "henshaw", value: "silent" },
    { type: "set_stance", characterId: "henshaw", value: "wounded_pride" }
  ],
  narrationHints: "Henshaw’s professionalism freezes into ice. He will not be drawn out.",
  reactions: [
    { characterId: "henshaw", lineHint: "I have said all I intend to say, Inspector." }
  ]
}
```

Narrator pack for Henshaw then includes `willingness: silent` and **no** further conditional knowledge unlocks that require `willingness open`.

### 5.6 Time + environment examples

**A. Discovery advances the clock (Colonel’s Bequest-style)**

```ts
// After major find — evening jumps
{
  id: "found_the_will",
  when: { type: "has_evidence", evidenceId: "forged-will" },
  once: true,
  trigger: "on_discover",
  effects: [
    { type: "advance_time", toSlotId: "after_dinner" },
    { type: "move_character", characterId: "guests_generic", toLocationId: "drawing-room" }
  ],
  narrationHints: "By the time you look up from the paper, dinner has ended. Chairs scrape in the dining room."
}
```

**B. Passive march — it grows late**

Definition:

```ts
time: {
  startSlotId: "guests_arrive",
  minutesPerTurn: 10,        // each player action costs story minutes
  schedule: [ /* slots */ ]
}
```

Each turn: `minutesFromStart += minutesPerTurn` (unless a beat already jumped time this turn — avoid double-counting).

**C. Schedule events — dinner ends, midnight strikes**

```ts
{
  id: "dinner_ends",
  once: true,
  trigger: "on_turn",
  when: { type: "time_at_least", slotId: "after_dinner" },
  effects: [
    { type: "set_phase", phaseId: "deepening" },
    { type: "move_character", characterId: "clara", toLocationId: "hallway" },
    { type: "set_willingness", characterId: "clara", value: "open" }
  ],
  narrationHints: "Covered dishes leave the dining room. The house loosens into smaller conversations."
}

{
  id: "midnight_strikes",
  once: true,
  trigger: "on_turn",
  when: { type: "time_reached", slotId: "midnight" },
  effects: [
    { type: "set_light", light: "night" },
    { type: "set_ambient", ambient: "ominous" },
    { type: "set_weather", weather: "storm", intensity: "peak" },
    { type: "queue_beat", beatId: "cry_from_the_gallery", delayTurns: 0 }
  ],
  narrationHints: "The long-case clock finishes twelve. Thunder answers from the grounds."
}
```

**D. Environment pulse — birds flock / crowd gathers**

```ts
{
  id: "birds_from_the_east_wing",
  once: true,
  trigger: "on_turn",
  when: {
    type: "and",
    of: [
      { type: "beat_fired", beatId: "letter_taken" },
      { type: "time_at_least", slotId: "late" }
    ]
  },
  effects: [
    { type: "pulse_environment", tag: "birds_flock" },
    { type: "set_environment_flag", id: "something_startled_the_birds", value: true }
  ],
  narrationHints: "A black cloud of birds erupts from the east wing as if something moved where nothing should."
}

{
  id: "crowd_at_the_gate",
  once: true,
  trigger: "on_turn",
  when: { type: "time_at_least", slotId: "late" },
  effects: [
    { type: "set_crowd", level: "gathering" },
    { type: "add_pressure", characterId: "mrs-blackwood", by: 1 }
  ],
  narrationHints: "Lanterns and voices pool at the gate. Onlookers. The family feels watched."
}
```

---

## 6. Knowledge vs story beats

| | **Knowledge beat** | **Story beat** |
|--|--------------------|----------------|
| About | What a character *knows / may say* | What *happens* in the investigation plot |
| Changes | Revealed set, what AI may utter | Entity state, map, inventory, phase |
| Example | “I saw Vale in the east corridor” | “Vale flees to the conservatory”; “door unlocks” |

Story beats often **reveal knowledge** as an effect. Knowledge should not by itself move people or unlock doors (keep side effects in story beats / inspect effects).

**Canon-only facts** (e.g. true killer details) live under `canon` and are never knowledge the narrator receives—even as “do not say …”.

---

## 7. What the AI receives each turn

### 7.1 ContextPack (principle)

**Default-deny for secrets.** Only list what is allowed.

```ts
ContextPack {
  meta: { title, tone, phase }
  player: { persona, briefing }
  game: { phase, turnCount, relevantGameFlags }
  time: {
    slotId, label,           // "Late evening"
    minutesFromStart
    // optional: nextSlotLabel for soft foreshadowing
  }
  environment: {
    weather, light, ambient, crowd
    activePulses?: string[]  // "birds_flock" this turn
  }
  location: {
    id, name,
    description,              // base + runtime appends
    exits: { to, label, open }[]
    inspectables: visible & interactable now
  }
  objectsHere / evidenceHeld
  charactersHere: [{
    id, name, voice,
    willingness, stance, pressure, alibiStatus,
    allowedKnowledge: string[]   // only unlocked
    // NOT full secret list
  }]
  justHappened: StoryBeatFired[]  // MUST be reflected in narration
  policy: closedWorld + noSolution
}
```

The model should weave **time and weather into tone** (“the dinner plates are gone”; “rain needles the glass”) without inventing schedule events that did not fire.

### 7.2 Engine before AI

Prefer:

1. **Advance passive time** (minutesPerTurn), unless a jump already ran.  
2. Interpret or classify intent (talk / inspect / use / move / present / accuse).  
3. Apply **mechanical** results (open door if key+use, grant evidence on inspect).  
4. Run **beat evaluation** (including time- and environment-gated beats) → mutate state.  
5. Build pack including `time`, `environment`, `justHappened`.  
6. AI narrates.  
7. Validate any model-proposed patch (conservative).

So: **key opens door in the engine**, **midnight fires in the engine**, AI describes the click, the cold air, the twelfth chime—not inventing whether dinner ended.

### 7.3 Turn pipeline with time (sketch)

```
on player input:
  1. passive time march (optional minutesPerTurn)
  2. resolve action → mechanical effects
  3. evaluate beats (conditions may use new time / inventory)
  4. apply effects (may advance_time jump, set weather, move people)
  5. if time jumped, evaluate beats again once (catch "dinner_ends")
  6. ContextPack → LLM
  7. commit state
```

Avoid infinite loops: beat evaluation runs in bounded passes (e.g. max 2–3 cascades per turn).

---

## 8. Phases (acts)

```ts
phases: [
  { id: "arrival", description: "Orient, meet household, first clues" },
  { id: "deepening", description: "Alibis, documents, contradictions" },
  { id: "crisis", description: "Someone breaks, flees, or a new incident" },
  { id: "confrontation", description: "Accusation is in play" }
]
```

Beats may `set_phase`. ContextPack tone guidance follows phase. Optional: phase entry fires `on_phase_enter` beats (constable arrives, etc.).

---

## 9. Canon (sealed)

```ts
canon: {
  timeline: { at: string, event: string, locationId?: string, actorIds?: string[] }[]
  solution: {
    culpritIds: string[]
    method: string
    motive: string
    summary: string
    requiredClaims: { id: string, description: string }[]
  }
}
```

- Used for ending evaluation and authoring sanity.  
- **Never** injected into narrator ContextPack.  
- Investigation beats must not contradict canon (author responsibility; optional lint later).

---

## 10. Authoring workflow (how to write a case)

1. **Write the crime** — canon timeline + solution (sealed envelope).  
2. **Build the stage** — locations, exits (note which start locked), objects, cast defaults (location, willingness).  
3. **Place discoveries** — inspectables grant evidence / change object state.  
4. **Draw the investigation spine** — ordered story beats (A→B→C).  
5. **Add branches** — missable clues, wrong-accuse reactions, clocks.  
6. **Wire character arcs** — willingness/pressure ladders per major NPC.  
7. **Playtest chains** — unit test conditions; human play for feel.  
8. **Apply three-clue rule** — each required claim reachable by ≥2 paths when possible.

Authors think in **“when the player does X / when Y becomes true → state changes → new possibilities.”**

---

## 11. Minimal Blackwood-style beat spine (example)

| Beat id | When | Effects (sketch) |
|---------|------|------------------|
| `vase_examined` | inspect vase | grant thread+print; object stages examined |
| `trail_known` | has print | game flag / notebook; soft narration only |
| `key_found` | inspect ash | grant key; object taken |
| `drawer_unlockable` | has key | set desk-drawer unlocked |
| `letter_taken` | inspect unlocked drawer | grant letter |
| `henshaw_opens_up` | has letter | reveal knowledge saw-Vale; stance helpful |
| `vale_cornered` | present letter to Vale | pressure+2; alibiStatus broken; willingness guarded |
| `vale_hostile` | pressure high + talked again | willingness hostile |
| `wrong_accuse_henshaw` | accuse henshaw without claims | henshaw silent; mrs-b stance cold |
| `crisis_constable` | turn ≥ N or phase crisis | add constable; set phase |

Chains: **vase → print → library → key → drawer → letter → Henshaw knowledge → Vale pressure → accuse.**

Dynamics: wrong branch **changes character state** so the house “remembers.”

---

## 12. Mapping to current v1 schema

| v1 today | v2 direction |
|----------|----------------|
| Global `flags[]` only | Game flags **+** character/object/location state maps |
| Knowledge public/private/secret | Knowledge with `when: Condition`; default-deny pack |
| Inspectable setsFlags / revealsEvidence | Keep; also set object state |
| Exit `requiresFlags` | Prefer `requires: Condition` including object unlocked / has evidence |
| Presence on location static | `characterState.locationId` + availability |
| No story beats | `beats[]` + evaluate each turn |
| Solution in definition root | Move under `canon.solution` (same secrecy rules) |
| Magic `has_brass_key` in engine | `has_evidence` condition or object state |

**Migration path:** keep running v1 JSON; introduce v2 fields optionally; engine gains entity state + beat loop without rewriting Blackwood in one shot.

---

## 13. Playthrough state (runtime shape)

```ts
PlaythroughState {
  id, caseId, contentVersion, status, turnCount
  phaseId
  gameFlags: Record<string, FlagValue>
  firedBeatIds: string[]
  beatQueue: { beatId, fireOnTurn }[]
  clocks: Record<string, number>       // countdown timers (turns), not story-time
  // Story time
  time: {
    slotId: string
    minutesFromStart: number
  }
  // Shared atmosphere
  environment: {
    weather: string
    weatherIntensity?: string
    light: string
    ambient?: string
    crowd?: string
    flags: Record<string, FlagValue>
    // pulses cleared after narrated turn or kept one turn
    activePulses: string[]
  }
  characterState: Record<string, CharacterState>
  objectState: Record<string, ObjectState>
  locationState: Record<string, LocationState>
  evidenceIds: string[]              // convenience index of inventory
  notebook: NotebookEntry[]
  characterMemory: ...               // dialogue memory (performance)
  presented: { evidenceId, characterId, turn }[]
  visitedLocationIds: string[]
}
```

Definition supplies **initial** state (including starting time slot + weather); playthrough stores **current**.

---

## 14. Testing entity + plot dynamics

Unit tests (no LLM):

- Key not held → exit closed / drawer locked  
- Grant key → effect opens exit → move legal  
- Willingness silent → knowledge with `when: willingness open` not in pack  
- Beat fires once; second evaluation no-op  
- Present letter → pressure effect → next condition true  

Leak tests (with LLM, nightly):

- Narrator pack never contains `canon.solution.summary`  
- Unreleased knowledge content not present in pack  

---

## 15. Principles (short)

1. **Typed state slices:** character, object, location, **environment**, **time**, plus game bookkeeping.  
2. **Story beats** chain discoveries into developments (and can jump or latch onto the clock).  
3. **Time marches** both as **unlock jumps** (find X → evening advances) and as **passive lateness** (turns cost minutes; dinner ends; midnight strikes).  
4. **Environment** is first-class atmosphere (weather, crowd, wildlife pulses)—not only location blurbs.  
5. **Conditions/effects** are the programming language of the mystery.  
6. **AI performs** current time, weather, and `justHappened`; it does not decide whether midnight came.  
7. **Doors, keys, silence, panic, storms, schedules** are state transitions—not vibes in a prompt.  
8. **Canon stays sealed**; investigation plot + world weather/time are the living layer.

---

## 16. Next implementation steps (when we build this)

1. Extend playthrough + definition types for entity state **+ environment + time schedule**.  
2. Implement `Condition` evaluator + `Effect` applier (including `advance_time`, `set_weather`, …).  
3. Add passive `minutesPerTurn` + beat evaluation after each turn (bounded cascades).  
4. Put `time`, `environment`, `justHappened`, and per-entity slices into ContextPack.  
5. Re-express Blackwood spine as beats (key/door/willingness + optional storm/midnight).  
6. Deprecate ad-hoc engine magic flags.

Until then, v1 flags remain a flat encoding of the same ideas—authors should still *think* in **entity + environment + time + chains** even when encoding as flags.
