# Player Surfaces & Ambient Knowledge

**Status:** Design (adopted) — UI implementation in progress
**Date:** 2026-07-20
**Related:** [CASE_AUTHORING.md](./CASE_AUTHORING.md) (author checklist), [CASE_DEFINITION.md](./CASE_DEFINITION.md) (state model), [ARCHITECTURE.md](./ARCHITECTURE.md) (API sketch)

---

## 1. The asymmetry this solves

In a novel, the author streams the protagonist's **ambient knowledge** to the
reader exactly when it matters. The protagonist already knows their house,
their town, the people around them — the author simply narrates it.

In our game the player *is* the protagonist but starts with none of that
knowledge. If turn-by-turn narration is the only channel, the player must
interrogate the world for information the character would simply *have*
("wait, what exits are there?", "who is this person again?"). That is
friction, not mystery — and every such question costs a full two-call LLM
turn to answer something a panel could show for free.

## 2. Principle

> **Ambient knowledge is free. Discoveries are earned.**

| Ambient (free, always visible) | Discovery (earned through play) |
|---|---|
| The room at a glance; doors and exits | Hidden clues, locked containers' contents |
| Who is physically present | Secrets, private knowledge, broken alibis |
| What you are carrying | Private relationship edges |
| Who these people are *socially* (front matter) | Who they really are |
| What your character already knew at case start | Everything the investigation reveals |
| Where you have been (map so far) | Places you haven't found |

Withholding ambient knowledge does not create mystery; it creates
obtuseness and fails our own fair-play principle: **the puzzle lives in
interpretation, not in information-access friction.**

## 3. Genre precedent

Golden Age mystery novels shipped with *front matter*: a dramatis personae
page, a floor plan of the manor, a map of the grounds, sometimes a
timetable. The authors understood this exact asymmetry and solved it with
diegetic reference material. So "novel-like" was never "no reference
surfaces" — it was "no **omniscient** surfaces."

## 4. The stance (revises the old "no HUD" line)

**IN — diegetic ambient surfaces:**
opening package (dossier or equivalent), scene panel, sketch map with fog
of war, cast dossier, notebook, authored imagery.

**OUT — omniscient game-state surfaces:**
relationship graphs, willingness/pressure/trust meters, clue checklists,
progress bars tied to the solution, unvisited map areas, "clue here" badges.

**The test for any proposed surface:** does it show what the *character*
perceives or knows — or what the *designer* knows matters? Only the first
belongs in the UI.

---

## 5. The surfaces

### 5.1 Opening package (required for every case)

Every mystery must ship the starting information its protagonist would
have. The **diegetic form follows the premise**:

| Premise | Form of the opening package |
|---------|-----------------------------|
| Professional (inspector, PI, journalist on assignment) | Dossier / telegram / letter of engagement |
| Invited outsider (guest, relative summoned to the manor) | The invitation + what you know of the family |
| **Accidental** (ordinary person who stumbles into a mystery) | No file at all — *lived familiarity*: your own house, your street, your coworkers, presented as "what you already know" |

Contents (adapted to form): who you are, why you are here, the victim or
incident (if known at start), the people you already know and how
(`knownToPlayerByDefault` relationship edges are the dramatis personae
filter), the setting basics, and `player.startingKnowledge`.

Encoding today: `meta.premise`, `player.startingKnowledge`,
`openingNarration`. A structured `briefing` field is planned (§8).

### 5.2 Scene panel (persistent)

Location name, exits with open/locked state, people present, visible
objects. This is a straight rendering of `ContextPack.location` — already
leak-filtered by the engine. Never shows hidden inspectables or importance
hints.

### 5.3 Map — fog of war

Rendered as a diegetic sketch (the detective's own floor plan, a hand-drawn
map of the grounds), not a game minimap.

**Known locations** = `visited` ∪ `known at start` ∪ `revealed by story`.

- **Known at start is persona-dependent.** A stranger detective arrives
  knowing almost nothing; an *accidental* protagonist in their own house
  knows every room before turn one — their map starts mostly revealed even
  though nothing has been "visited" in play. Authors must set this
  deliberately.
- **Revealed by story:** hearing "the ice house is past the kitchen garden"
  should be able to add an unvisited location to the map (planned
  `reveal_location` effect).
- Secret rooms and gated areas stay off the map until discovered. Exits
  render only where the character has perceived them.

**Rendering (decided): data-driven SVG, not a painted image.** Draw the map
from `playerView.map` (`locations` with authored `{x,y,floor}` grid coords +
`connections`), styled as the detective's hand sketch: paper texture, ink
strokes, handwriting labels, slight per-room rotation jitter (seeded by
location id), optional `feTurbulence`/`feDisplacementMap` wobble. Rationale:
fog of war is free (unknown rooms simply aren't rendered), zero per-case art
cost, and SVG is interactive/accessible (click a room to travel via the
normal composer path; the engine still validates the move). Room states:
visited (solid ink) / known-unvisited (faint dashed — "heard of it") /
current (you-are-here mark). Connections: solid = open door seen; dashed +
lock glyph = closed; `destinationKnown: false` = short "?" stub (a door
you've seen but never taken). Floors render as tabs. Authored
`locations[].image` establishing shots belong in the scene panel (and
optionally visited-room tooltips) — never as the map itself. A flagship
case may later add a painted underlay sharing the same coordinate space.

Engine: `locationState.known`, `knownAtStart` seeds, `reveal_location`, and
`playerView.map` (locations + connections) are implemented; `GET /map` (or
just the map field of the turn/resume PlayerView response) is the UI hookup.

### 5.4 Presence strip & character profiles

**Presence strip (persistent):** a portrait row of who is physically in the
room (`location.presentCharacters`), each labeled with what the player
currently knows them as — which may be just **"Orderly"** (White Room) when
no name has been learned, or "Mr. Vale" when introductions happened in the
opening package.

**Identity is knowledge — a three-stage ladder.** Existence first: a
character with `knownAtStart: false` does not appear on the mystery detail
page, the cast panel, or in any pack until they enter the story (an
authored `entrance` — arrival or mention — a `reveal_character` effect, or
simply being met). Then the label: `knownAs` evolves *"Orderly" → "the
orderly — calls himself Marcus" → "Marcus Reed."* The cast panel **grows**
during play as people are discovered — a dramatis personae that fills in,
which is itself a storytelling surface (a new portrait appearing is an
event). Whether a name or an existence is known at start is per-case,
per-character authoring (a dinner party introduces everyone; an amnesia
ward introduces no one; the best twist arrives at midnight).

**Expandable profile (tap a portrait or the cast list):** a **dramatis
personae entry, not a growing dossier.** Deliberately minimal — just enough
to keep the characters straight:

- portrait, `knownAs` (or name once revealed)
- title / role line ("Butler", "the victim's business partner")
- a brief authored outline (`shortBio`) — front matter the story *starts*
  with, including starting-known relationships phrased as part of the
  outline

**Profiles do not accumulate.** Nothing the player learns during play is
appended here — no claims, no discovered facts, no growing dossier. What
the player learns lives where it always did: the prose, the auto notebook,
and their own scratchpad notes. The only thing that changes on a profile
over a playthrough is *identity itself* (a name reveal updating "Orderly"
to "Marcus Reed").

Never rendered: willingness, pressure, trust, unrevealed knowledge,
private edges, guilt. A portrait and the word "Orderly" is a complete,
valid profile.

### 5.5 Inventory

What the player carries, rendered diegetically ("your pockets", "your
satchel"): name, description, condition/tags from `pack.inventory`
(engine-owned, already leak-filtered). Red herrings render identically to
critical evidence — no importance markers, ever. Items lost to theft
disappear from the panel the turn the engine removes them (the prose
stages the loss; the panel confirms it).

### 5.6 Notebook — auto log + private scratchpad

Two kinds of entries, one surface:

- **Auto entries** (`source: "auto"`) — engine-written via `notebook_append`
  effects; the case's own record of key moments.
- **Player notes** (`source: "player"`) — free text the player writes.
  Persisted with the playthrough, editable, and **deliberately inert: never
  parsed by the engine, never sent to any prompt, never read by the game.**

The inertness is the feature, not a limitation:

1. **Private theorizing.** The player can write "it's Vale, I'm sure" in
   their notes without the director or the accuse gate ever seeing it —
   notes must never trigger game machinery.
2. **Zero cost** — never enters a prompt, so it never spends a token.
3. **Zero leak surface** — nothing written here can echo back through
   narration.

Schema support already exists (`NotebookEntry.source: "auto" | "player"`),
and the notebook never enters the ContextPack. Needed: note add/edit/delete
API + UI (§8).

### 5.7 Imagery — authored, not runtime-generated

Portraits (exists), case cover (exists), location establishing shots
(recommended). Produce them **at authoring time** in the same offline
pipeline as the rest of the case content, where they can be reviewed for
style consistency and accidental spoilers — a generated image of the
library that happens to show a key in the hearth ash is a leak. Runtime
image generation is out for v1 (cost, latency, consistency, leak review).

---

## 6. Data sources per surface

**All surfaces are served by one engine call: `buildPlayerView(def, state)`**
(`packages/engine/src/player-view.ts`) — the UI-safe projection. It is NOT
the ContextPack (which carries narrator-only material) and is leak-tested.

| Surface | Source (`buildPlayerView` field) | Status |
|---------|----------------------------------|--------|
| Opening package | `openingPackage` — authored `player.briefing` or derived from premise/startingKnowledge/objective | **Engine done**; UI needed |
| Scene panel | `scene` — exits (open state, no requirement ids), presence (knownAs), object names | **Engine done**; UI needed |
| Map (fog of war) | `map` — known locations only (`knownAtStart` ∪ visited ∪ `reveal_location`), authored `map` coords, plus `connections` (edges from visited rooms; unknown destinations = "?" stubs) | **Engine done**; `GET /map` route + UI needed |
| Presence strip | `scene.present` — portraits + `knownAs` labels | **Engine done**; UI needed |
| Character profile (dramatis personae) | `cast` — `knownAs`, `nameKnown`, `storyRole`, portrait, bio (suppressed until name known) | **Engine done**; UI needed |
| Inventory panel | `inventory` — name, description, condition, tags (no item flags) | **Engine done**; UI needed |
| Notebook (auto + player scratchpad) | `notebook` (`source: auto \| player`); player notes never enter prompts | Engine done; note-edit API + UI needed |
| Time/weather strip | `time.label`, `environment` | **Engine done**; UI optional |

## 7. Fair-play guardrails

1. The map never shows unknown locations, secret doors, or exits the
   character hasn't perceived.
2. No surface highlights anything because the *author* knows it matters.
3. The cast panel renders knowledge state, never engine internals
   (willingness/pressure/trust stay in prose behavior).
4. The scene panel lists only `visibleInspectables` (already flag-filtered).
5. Surfaces **render** state; they never grant it. Only engine effects and
   visits reveal — the UI cannot.
6. Everything shown must be derivable from the ContextPack or playthrough
   state the player legitimately has. If a surface needs data the pack
   doesn't expose, that's a design smell — ask why the narrator can't see
   it either.
7. **Narration respects `knownAs`.** Until the player learns a name, the
   performer and every surface use the known label ("the orderly"), never
   the definition's real name. Profiles are front matter plus identity
   state — never a growing factbook; discoveries live in prose and the
   notebook, so nothing a liar says can be laundered into a profile as
   truth.
8. Red herrings are indistinguishable from critical evidence in every
   surface (inventory, profiles, notebook).

## 8. Schema & engine reference (implemented; API routes pending)

Everything below is implemented in `packages/shared` + `packages/engine`
(see `static-pack`/`identity`/`player-view` modules and their tests) except
the API routes and UI, which consume `buildPlayerView(def, state)`.

```jsonc
// definition additions (optional, backwards compatible)
"player": {
  "briefing": {                    // structured opening package
    "form": "dossier",           // dossier | letter | telegram | invitation | memory | custom
    "title": "The Blackwood File",
    "sections": [{ "heading": "The dead man", "text": "…" }]
  }
},
"locations": [{
  "id": "kitchen",
  "knownAtStart": true,            // persona familiarity → pre-revealed on map
  "map": { "x": 2, "y": 1, "floor": 0 },  // authored sketch coordinates
  "image": "locations/kitchen.jpg" // authored establishing shot
}]
```

- Runtime `locationState.known: boolean` + effect
  `reveal_location { locationId }` + condition `location_known`.
- Initialize `known` from `knownAtStart` ∪ starting location.
- `GET /v1/playthroughs/:id/map` → known locations, their known exits,
  current position.
- Notebook scratchpad: `POST /v1/playthroughs/:id/notes` (+ edit/delete of
  `source: "player"` entries only — auto entries are immutable). Invariant:
  player notes are write-only from the game's perspective; no engine or
  prompt path may read them.

```jsonc
// character identity (optional, planned)
"characters": [{
  "id": "orderly",
  "name": "Marcus Reed",            // definition truth
  "introducedAs": "Orderly",        // player's initial label
  "nameKnownAtStart": false         // manor dinner: true; amnesia ward: false
}]
```

- Runtime `playerKnowledge: Record<characterId, { knownAs, nameKnown }>` —
  identity only. Profiles never accumulate learned facts (see §5.4); the
  brief outline comes straight from authored `shortBio` / `storyRole`.
- Effects: `reveal_character_name { characterId }`,
  `set_known_as { characterId, label }`.
- ContextPack: per-character `knownAs` + performer rule "use knownAs until
  the name is revealed". Accusation `matchHints` should include role labels
  ("orderly") for name-unknown cases so "the orderly did it" scores.
- UI (apps/web): persistent scene panel + presence strip (portraits +
  `knownAs`); tap → character profile (learned-facts ledger); drawers for
  Case File / Map / Cast / Inventory / Notebook. Opening package shown at
  case start and reopenable.

## 9. Authoring requirement

These surfaces are **part of authoring a mystery**, not platform chrome:
the opening package, the starting map knowledge, and cast front matter are
case content. See CASE_AUTHORING.md §18 "Player surfaces" and the shipping
checklist.
