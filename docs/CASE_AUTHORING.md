# Case definition authoring reference

**Audience:** people writing mysteries as `definition.json`  
**Machine source of truth:** `packages/shared` Zod schemas (`MysteryDefinitionSchema`)  
**JSON Schema (editors):** `content/cases/definition.schema.json` — regenerate with `pnpm schema`  
**Live example:** `content/cases/blackwood-inheritance/definition.json`  
**Conceptual background:** [CASE_DEFINITION.md](./CASE_DEFINITION.md)

A **case definition** is the complete authored kit for one mystery. The engine loads it, enforces it, and mutates **playthrough state**. The AI only performs: it does not invent the killer, rooms, or major plot turns.

---

## 1. What you are writing

| Layer | Purpose | AI sees it? |
|-------|---------|-------------|
| **Canon** | Sealed crime timeline / notes | **No** |
| **World** | Places, exits, inspectables, cast, items | Yes (filtered by state) |
| **Solution + endings** | How to win/lose and epilogue material | Only after judgment / ending pack |
| **Beats** | When → effects (the living plot) | Results + `justHappened`, not full graph |
| **Relationships** | Social graph edges | Behavior + speakable surface |

**Product stance:** novel-like experience. Bonds and clues appear in prose, not as a detective dashboard. Still **author everything** the engine must own.

### File layout

```
content/cases/
  definition.schema.json          # generated JSON Schema (autocomplete)
  <case-id>/
    definition.json               # your case — point $schema at ../definition.schema.json
```

At the top of each case file:

```json
{
  "$schema": "../definition.schema.json",
  "schemaVersion": "1.5",
  ...
}
```

VS Code / Cursor pick this up via `.vscode/settings.json` (workspace). Regenerate after schema changes:

```bash
pnpm schema
# or: pnpm --filter @mystery/shared schema
```

Validate by parsing with `parseMysteryDefinition` (shared package) or loading the API (invalid cases are skipped at boot).

---

## 2. Minimal skeleton

```json
{
  "schemaVersion": "1.5",
  "id": "my-case-id",
  "contentVersion": "0.1.0",
  "meta": {
    "title": "Title",
    "premise": "Short shelf-card hook (1–2 sentences)",
    "setting": "Where/when — bookstore setting line",
    "summary": "Longer jacket blurb: scene, stakes, cast, no spoilers",
    "theMystery": "The central question the player must answer",
    "tone": "how it should feel",
    "estimatedMinutes": 40,
    "tags": ["Manor"],
    "difficulty": "medium",
    "contentWarnings": ["murder"]
  },
  "player": {
    "personaId": "optional-recurring-id",
    "displayName": "Inspector Cross",
    "addressAs": "Inspector",
    "pronouns": "he/him",
    "role": "Role in *this* mystery (guest, inspector, patient…)",
    "authority": "official",
    "gender": "optional",
    "age": "optional age band",
    "appearance": "optional look",
    "clothing": "optional outfit in this mystery",
    "background": "what the world may know about you",
    "publicPerception": "how this cast sees you at start",
    "voiceNotes": "manner",
    "performanceNotes": "how NPCs should treat this persona",
    "startingLocationId": "hall",
    "startingEvidenceIds": [],
    "startingKnowledge": "Facts at turn 0 (briefing + AI).",
    "objective": "What the player must do to solve this mystery."
  },
  "openingNarration": "Second-person cold open that ends by making the mystery and next step clear…",
  "locations": [ /* at least one */ ],
  "characters": [],
  "relationships": [],
  "evidence": [],
  "flags": [],
  "phases": [{ "id": "arrival" }],
  "beats": [],
  "solution": {
    "summary": "Sealed full truth…",
    "guiltyPartyIds": ["culprit-id"],
    "method": "…",
    "motive": "…",
    "criticalEvidenceIds": [],
    "rubric": {
      "partialCredit": true,
      "allowWithoutEvidence": true,
      "successPolicy": "identity_plus_one",
      "requiredFacts": [
        {
          "id": "killer",
          "role": "identity",
          "description": "Names the culprit",
          "matchHints": ["culprit-id", "surname"]
        }
      ]
    }
  },
  "endings": [
    {
      "id": "success",
      "when": "success",
      "kind": "solved",
      "title": "Case closed",
      "templateNotes": "Epilogue guidance for the performer…"
    },
    {
      "id": "failure_wrong",
      "when": "failure",
      "kind": "wrong_accusation",
      "title": "Wrong man",
      "templateNotes": "…"
    }
  ],
  "wrapUp": { "enabled": true, "maxTurns": 10, "allowEarlyExit": true },
  "canon": { "timeline": [], "notes": "" },
  "time": {
    "startSlotId": "evening",
    "minutesPerTurn": 10,
    "schedule": [
      { "id": "evening", "label": "Evening", "minutesFromStart": 0 }
    ]
  },
  "environment": {
    "weather": "clear",
    "light": "lamplight",
    "crowd": "none"
  }
}
```

---

## 3. Root fields (reference)

| Field | Required | Description |
|-------|----------|-------------|
| `schemaVersion` | yes | `"1"` or `"1.5"` (use **1.5**) |
| `id` | yes | Stable case id (directory name usually matches) |
| `contentVersion` | yes | Bump when content changes (`0.1.0` …) |
| `meta` | yes | Catalog / marketing fields |
| `player` | yes | Persona + start |
| `openingNarration` | yes | First prose the player sees |
| `locations` | yes | ≥1 location |
| `characters` | no | Cast (default `[]`) |
| `relationships` | no | Directed social edges |
| `evidence` | no | Collectible / presentable items |
| `flags` | no | Named game flags + defaults |
| `phases` | no | Act labels (`arrival`, `deepening`…) |
| `beats` | no | Story unlock graph |
| `solution` | yes | Truth + accuse rubric |
| `endings` | yes | ≥1 ending |
| `wrapUp` | no | Interactive denouement (default enabled if omitted in engine logic) |
| `canon` | no | Sealed timeline (never in AI pack) |
| `time` | no | Story clock schedule |
| `environment` | no | Default weather / light / crowd |

---

## 4. Player

```json
"player": {
  "displayName": "Inspector",
  "role": "Police inspector called to the manor",
  "voiceNotes": "Professional, direct",
  "startingLocationId": "entrance-hall",
  "startingEvidenceIds": [],
  "startingKnowledge": "Briefing text the character already knows."
}
```

- `startingLocationId` must exist in `locations`.
- `startingEvidenceIds` must exist in `evidence` (items start in inventory).

---

## 5. Locations, exits, inspectables

```json
{
  "id": "library",
  "name": "The library",
  "description": "Cold and dark. Ash in the hearth…",
  "startsAccessible": true,
  "exits": [
    {
      "toLocationId": "entrance-hall",
      "label": "back to the hall",
      "startsClosed": false,
      "requiresEvidenceIds": [],
      "requiresFlags": {}
    }
  ],
  "inspectables": [
    {
      "id": "desk-drawer",
      "name": "desk drawer",
      "objectId": "desk-drawer",
      "hiddenUntilFlags": {},
      "onInspect": {
        "narrativeHints": "What the AI should convey when open succeeds.",
        "revealsEvidenceIds": ["vale-letter"],
        "setsFlags": { "found_vale_letter": true },
        "requiresEvidenceIds": ["brass-key"],
        "requiresFlags": {}
      }
    }
  ],
  "charactersPresent": [
    { "characterId": "henshaw", "requiresFlags": {} }
  ]
}
```

| Idea | How |
|------|-----|
| Locked exit | `startsClosed: true` then beat `set_exit_open` |
| Keyed door | `requiresEvidenceIds: ["brass-key"]` |
| Hidden inspectable | `hiddenUntilFlags` |
| Container object | `objectId` + engine locks if `requiresEvidenceIds` on inspect |

**Presence:** definition list is a default; runtime `characterState.locationId` can move people via beats.

---

## 6. Characters & knowledge

```json
{
  "id": "vale",
  "name": "Mr. Vale",
  "shortBio": "House guest…",
  "voice": "Smooth, defensive when cornered",
  "portrait": "portraits/vale.jpg",
  "defaultLocationId": "entrance-hall",
  "defaultWillingness": "guarded",
  "defaultStance": "polite_mask",
  "knowledge": {
    "public": "Always allowed unless silent/fled.",
    "private": [
      {
        "id": "vale-admits-argument",
        "content": "Fact they may share when gates pass.",
        "requiresEvidenceIds": ["vale-letter"],
        "requiresWillingnessIn": ["open", "guarded", "hostile"],
        "requiresTrust": 0,
        "requiresRelationshipIds": [],
        "requiresFlags": {}
      }
    ],
    "secrets": []
  },
  "defenses": ["Denies murder", "Insists on alibi"]
}
```

### Portraits

| Field | Where | Meaning |
|-------|--------|---------|
| `character.portrait` | per cast member | Path **relative to the case folder** (e.g. `portraits/henshaw.png`) |
| `meta.artStyle` | case meta | Shared visual brief so all portraits match (style, lighting, era) |

Files live under:

```
content/cases/<case-id>/
  definition.json
  portraits/
    henshaw.png
    vale.png
    …
```

API serves them at:

```
GET /v1/cases/<case-id>/assets/portraits/henshaw.png
```

Playthrough JSON includes `cast[].portraitUrl` and `characters[id].portraitUrl` for the UI. Keep one art style per case (oil gothic, pulp noir, etc.) — regenerate the whole set if the style changes.

### Willingness ladder

`open` → `guarded` → `hostile` → `silent` / `fled`

Silent/fled share almost nothing useful.

### Knowledge gates (all must pass)

| Field | Meaning |
|-------|---------|
| `requiresFlags` | Game flags equal values |
| `requiresEvidenceIds` | Player holds these |
| `requiresWillingnessIn` | Current willingness in list |
| `requiresTrust` | `characterState.trust >= n` |
| `requiresRelationshipId(s)` | Edge active **and** `knownToPlayer` |

Use `reveal_knowledge` effect to force-add a knowledge id to memory when a beat fires.

---

## 7. Relationships (social graph)

Directed edges A → B. Novel-like: no player relationship map.

```json
{
  "id": "vale_debt_blackwood",
  "fromId": "vale",
  "toId": "mrs-blackwood",
  "type": "debt",
  "label": "financial entanglement",
  "strength": 3,
  "public": false,
  "knownToPlayerByDefault": false,
  "startsActive": true,
  "notes": "Private AI behavior: do not dump casually."
}
```

| Field | Meaning |
|-------|---------|
| `public` | Safe social surface / gossip |
| `knownToPlayerByDefault` | Starts known |
| `notes` | Behavior guidance when private |

**Effects:** `reveal_relationship`, `set_relationship`, `set_relationship_strength`, `set_relationship_active`  
**Conditions:** `relationship`, `relationship_known`, `relationship_strength_at_least`

---

## 8. Evidence & inventory

```json
{
  "id": "vale-letter",
  "name": "Vale's letter",
  "description": "Letter signed by Mr. Vale…",
  "discoverableAt": {
    "locationId": "library",
    "inspectableId": "desk-drawer"
  },
  "canPresentTo": ["vale", "henshaw"],
  "redHerring": false
}
```

**Inventory** at runtime:

- `evidenceIds[]` — held ids  
- `objectState[id]` — full item state:

| Field | Notes |
|-------|--------|
| `stage` | hidden / visible / examined / **taken** / destroyed / given_away |
| `holder` | `"player"` when in inventory |
| `condition` | intact, torn, wet, opened… |
| `tags` | free strings |
| `flags` | item-local |
| `timesExamined` / `timesUsed` | counters |

Player says “what am I carrying?” → inventory intent → engine lists items with state.

---

## 9. Flags

```json
{
  "id": "found_vale_letter",
  "description": "Player recovered the letter",
  "aiVisible": true,
  "defaultValue": false
}
```

Prefer typed state (willingness, object stage, relationships) when possible; flags for abstract plot facts.

---

## 10. Time & environment

```json
"time": {
  "startSlotId": "just_after_eleven",
  "minutesPerTurn": 8,
  "schedule": [
    { "id": "just_after_eleven", "label": "Just after eleven", "minutesFromStart": 0 },
    { "id": "midnight", "label": "Midnight", "minutesFromStart": 120 }
  ]
},
"environment": {
  "weather": "storm",
  "weatherIntensity": "heavy",
  "light": "lamplight",
  "ambient": "tense",
  "crowd": "none",
  "flags": {}
}
```

- Prefer conditions `time_at_least` over edge-only `time_reached`.  
- Beats can `advance_time` (jump) or wait for passive march.

---

## 11. Solution & accusation

```json
"solution": {
  "summary": "Full sealed truth narrative…",
  "guiltyPartyIds": ["vale"],
  "method": "Struggle in the hall…",
  "motive": "Silence exposure…",
  "criticalEvidenceIds": ["vale-letter"],
  "rubric": {
    "partialCredit": true,
    "allowWithoutEvidence": true,
    "successPolicy": "identity_plus_one",
    "requiredFacts": [
      {
        "id": "killer-vale",
        "role": "identity",
        "description": "Identifies Vale",
        "matchHints": ["vale"]
      },
      {
        "id": "method-hall",
        "role": "method",
        "description": "Hall / struggle",
        "matchHints": ["hall", "struggle", "stairs", "vase"]
      },
      {
        "id": "motive-fraud",
        "role": "motive",
        "description": "Exposure / money",
        "matchHints": ["fraud", "letter", "expose", "money"]
      }
    ]
  }
}
```

| Policy | Full success when |
|--------|-------------------|
| `identity` | Correct culprit only |
| `identity_plus_one` | Culprit + ≥1 supporting fact (**default**) |
| `all_facts` | Every required fact matches |

**Important:** Success does **not** require holding evidence. Cold correct guesses can win (`lucky_solve` vs `solved` / earned path via `criticalEvidenceIds`).

`matchHints` are case-insensitive, **negation-aware** matches against the accusation text (summary + method + motive). "It wasn't Vale" does not count as naming Vale; suspect ids resolved by the director are matched structurally.

### Confirmation gate (`accusePolicy`, optional root field)

Informal accusations ("Vale did it") are **not judged immediately**: they go pending and the performer asks, in-fiction, whether the player formally commits. Formal wording ("I accuse Vale", "arrest him") or confirming/repeating while pending triggers judgment. Withdrawal or expiry clears it.

```json
"accusePolicy": { "requireConfirmation": true, "pendingTurns": 3 }
```

Both fields optional; defaults shown. Set `requireConfirmation: false` for judge-on-first-utterance.

### Generic accusation flags (react in beats)

The engine sets game flags whenever suspects are named — no engine hardcodes per case:

| Flag | Set when |
|------|----------|
| `accused_<characterId>` | The character is named in a pending **or** scored accusation |
| `falsely_accused_<characterId>` | A scored accusation named them and they are not guilty |

Example: Blackwood's `henshaw_shuts_down` beat fires on `game_flag falsely_accused_henshaw`.

---

## 12. Endings

```json
{
  "id": "success_lucky",
  "when": "success",
  "kind": "lucky_solve",
  "title": "A shot in the dark that hit",
  "templateNotes": "Performer epilogue spine…",
  "requiresFlags": {}
}
```

| `when` | Meaning |
|--------|---------|
| `success` | Solved (full) |
| `partial` | Thin but accepted |
| `failure` | Lost |
| `custom` | Rare |

| `kind` (examples) | Use |
|-------------------|-----|
| `solved` / `lucky_solve` / `partial` | Win flavors |
| `wrong_accusation` | Bad accuse |
| `time_expired` | Schedule ran out |
| `murdered` | Detective killed |
| `arrested` | Overreach |
| `escaped` | Culprit fled |

Always author **at least** success + one failure. Prefer multiple failures with distinct `id`/`kind`.

---

## 13. Wrap-up (denouement)

```json
"wrapUp": {
  "enabled": true,
  "maxTurns": 10,
  "allowEarlyExit": true,
  "performanceNotes": "Stay interactive after judgment…"
}
```

After accuse/fail beat: status becomes **`denouement`** (still interactive), then **`solved`/`failed`** when turns run out or player leaves.

Aftermath beats use:

```json
"when": { "type": "in_denouement" }
```

combined with `resolution_outcome` / `resolution_kind`.

---

## 14. Story beats (the plot graph)

```json
{
  "id": "letter_unlocks_deepening",
  "title": "The letter changes the house",
  "once": true,
  "trigger": "on_discover",
  "when": { "type": "has_evidence", "evidenceId": "vale-letter" },
  "effects": [
    { "type": "set_phase", "phaseId": "deepening" },
    { "type": "advance_time", "toSlotId": "late_evening" },
    { "type": "set_willingness", "characterId": "henshaw", "value": "open" },
    { "type": "reveal_relationship", "relationshipId": "vale_debt_blackwood" }
  ],
  "narrationHints": "Guidance for performer this turn.",
  "reactions": [
    {
      "characterId": "henshaw",
      "lineHint": "If you have that letter…",
      "stance": "reluctant_ally"
    }
  ]
}
```

### Triggers (enforced)

| Trigger | When it may fire |
|---------|------------------|
| `on_turn` | Condition true on **tick** or **player** beat pass |
| `on_discover` | Player pass + evidence gained **this turn** |
| `on_present` | Present happened this turn |
| `on_talk` | Talk this turn |
| `on_phase_enter` | Phase entered in this cascade |
| `manual` | Only via `queue_beat` |

### Engine turn order (know this)

```
1. Passive time + clock tick
2. Beats (source: tick)     ← time/clock failures before player acts
3. Director + patch
4. Beats (source: player)   ← discover / present / talk unlocks
5. Denouement budget / exit
6. Performer
```

---

## 15. Conditions catalog

Compose with `and` / `or` / `not`.

### Logic
- `{ "type": "always" }` / `"never"`
- `{ "type": "and", "of": [ ... ] }`
- `{ "type": "or", "of": [ ... ] }`
- `{ "type": "not", "of": { ... } }`

### Game / case
- `phase_is` — `{ phaseId }`
- `turn_at_least` — `{ n }`
- `game_flag` — `{ id, equals }`
- `beat_fired` — `{ beatId }`
- `case_active` / `case_status` / `case_interactive` / `in_denouement`
- `resolution_outcome` / `resolution_kind` / `resolution_path`
- `clock_expired` / `clock_running` / `clock_at_most` — `{ clockId, n? }`

### Progress
- `has_evidence` / `inventory_has` — `{ evidenceId }` or `{ itemId }`
- `visited` — `{ locationId }`
- `presented` — `{ evidenceId, toCharacterId }`
- `talked_to` — `{ characterId, minTimes? }`
- `player_at` / `player_not_at` — `{ locationId }`

### Character
- `character_willingness` — `{ characterId, is }`
- `character_pressure_at_least` / `character_trust_at_least` — `{ characterId, value }`
- `character_at` — `{ characterId, locationId }`

### Object / inventory item
- `object_stage` — `{ objectId, is }`
- `object_unlocked` — `{ objectId }`
- `item_condition` — `{ itemId, is }`
- `item_flag` — `{ itemId, id, equals }`
- `item_has_tag` — `{ itemId, tag }`
- `item_examined_at_least` / `item_used_at_least` — `{ itemId, n }`
- `item_holder` — `{ itemId, is: "player" }`

### Location / env / time
- `location_accessible` — `{ locationId }`
- `exit_open` — `{ from, to }`
- `time_slot_is` / `time_at_least` / `time_reached` / `time_minutes_at_least`
- `weather_is` / `crowd_is` / `environment_flag`

### Relationships
- `relationship` — `{ fromId, toId, relationshipType? }` or `{ relationshipId }`
- `relationship_known` — `{ relationshipId }`
- `relationship_strength_at_least` — `{ relationshipId, value }`

### Player threat
- `player_threat_is` / `player_threat_at_least`
- `player_safe_haven_compromised`
- `player_has_tag` / `player_status_flag`

---

## 16. Effects catalog

### Game / case close
- `set_game_flag` — `{ id, value }`
- `set_phase` — `{ phaseId }`
- `start_clock` — `{ clockId, turns }`
- `queue_beat` — `{ beatId, delayTurns? }`
- `end_case` — `{ outcome, endingId?, endingKind? }`
- `end_denouement` / `finalize_case`

### Time / environment
- `advance_time` — `{ toSlotId }` or `{ byMinutes }`
- `set_weather` / `set_light` / `set_crowd` / `set_ambient`
- `set_environment_flag` / `pulse_environment` — `{ tag }`

### Character
- `set_willingness` / `set_stance` / `add_pressure` / `add_trust` / `set_trust`
- `move_character` — `{ characterId, toLocationId }`
- `set_character_available` — `{ characterId, value }`
- `reveal_knowledge` — `{ characterId, knowledgeId }`
- `set_alibi_status` — `{ characterId, value }`

### Objects / inventory
- `grant_evidence` / `remove_evidence` — `{ evidenceId }`
- `move_object` — `{ objectId, to: "inventory" | locationId }`
- `set_object_stage` / `set_object_locked`
- `set_item_condition` / `set_item_flag` / `add_item_tag`
- `examine_item` / `use_item` — `{ itemId }`

### Location / player status
- `set_location_accessible` / `set_exit_open` / `append_location_description`
- `move_player` — `{ toLocationId, text? }` force-relocate (escort, drag, intercept)
- `set_player_threat` — `{ threat: none|watched|threatened|assaulted, force? }` escalates only unless force
- `set_player_condition` / `harm_player` — `{ condition: unharmed|shaken|bruised|injured|incapacitated, text?, force? }` bodily harm; `harm_player` always emits justHappened
- **Physical control** (orthogonal to injury; blocks voluntary leave while not free):
  - `hold_player` — grabbed / gripped (`byCharacterId?`, `text?`)
  - `knock_down_player` — on the floor, conscious
  - `restrain_player` — bound / pinned
  - `knock_out_player` — unconscious
  - `release_player` — free again
  - `set_player_control` — `{ control: free|held|downed|restrained|unconscious, byCharacterId?, force?, text? }`
- `steal_from_player` — `{ itemId? | preferItemIds? | anyHeld?, exceptItemIds?, toLocationId?, holder?, text? }` remove held evidence and stage theft
- `set_safe_haven_compromised` / `add_player_tag` / `set_player_status_flag`
- `notebook_append` — `{ text }` (quiet bookkeeping)

### Progress UI (optional)

```json
"meta": {
  "progressUi": "off" | "subtle" | "full"
}
```

| Mode | Behavior |
|------|----------|
| `off` (default if omitted) | No progress cues |
| `subtle` | Spoiler-light toasts when something unblocks |
| `full` | Toasts + coarse depth meter (not a solve %) |

Players pick Off / Subtle / Full **per playthrough** via the gear icon in the play chrome (Play settings), not as a global account setting. Different mystery runs keep different choices. If the author sets `off`, progress UI stays off for that mystery. Engine computes signals from phase, story beats, and critical evidence — never solution spoilers.

### Plot hits the player (core engine — open situations, fixed tools)

**Do not catalog every way the world can act on the player.**  
AI + story invent situations. The engine only exposes fixed **effects**.

```json
"worldToPlayer": {
  "active": true,
  "summary": "Bouncer throws you onto the street",
  "effects": [
    { "type": "set_player_threat", "threat": "threatened" },
    { "type": "move_player", "toLocationId": "street" },
    { "type": "set_willingness", "characterId": "bouncer", "value": "hostile" }
  ]
}
```

Allowlist: `move_player`, `harm_player`, `hold_player`, `steal_from_player`, `set_player_threat`, …  
(`WORLD_TO_PLAYER_EFFECT_TYPES` in engine). Ids must exist in the pack.

Turn phase **`resolveWorldToPlayer`** always runs after beats. Authored beats + `location.hazards` remain for fair-play set pieces.

### Relationships
- `reveal_relationship` / `set_relationship` / `set_relationship_strength` / `set_relationship_active`

---

## 17. Canon (sealed)

```json
"canon": {
  "timeline": [
    {
      "id": "confrontation",
      "at": "Just before eleven",
      "event": "Vale confronts Blackwood; vase shatters…",
      "locationId": "entrance-hall",
      "actorIds": ["vale"]
    }
  ],
  "notes": "Author-only notes. Never sent to AI packs."
}
```

Write the crime **first**, then build discovery paths that fair-play support the solution.

---

## 18. Authoring workflow (recommended order)

1. **Crime** — `canon.timeline` + `solution` (sealed envelope).  
2. **Stage** — locations, exits, starting cast positions.  
3. **Discoveries** — evidence + inspectables that grant them.  
4. **Cast knowledge** — public / private / secrets with gates.  
5. **Relationships** — who is bound to whom; what stays private.  
6. **Spine beats** — discovery → deepening → pressure → accuse.  
7. **Failure beats** — wrong accuse, time, threat clocks, arrest.  
8. **Wrap-up beats** — denouement reactions for success and failure.  
9. **Endings** — distinct `templateNotes` per outcome/kind.  
10. **Playtest** — unit-test condition chains; human play for feel.  
11. **Three-clue rule** — each required claim reachable ≥2 ways when possible.

Think: **when X becomes true → state changes → new possibilities.**

---

## 19. Checklist before shipping a case

- [ ] `schemaVersion` `1.5`, unique `id`, bumped `contentVersion`  
- [ ] All location/exit/character/evidence ids consistent  
- [ ] Player start location exists  
- [ ] Every required rubric fact has solid `matchHints`  
- [ ] Success ending + ≥1 failure ending  
- [ ] Critical discovery chain has beats (`on_discover` / `on_present` as appropriate)  
- [ ] Failure clocks/time use `on_turn` + `case_active`  
- [ ] Denouement beats gated with `in_denouement`  
- [ ] Secrets never only reachable by AI invention (gates or reveal effects)  
- [ ] Opening narration + starting knowledge don’t spoil the solution  
- [ ] Loads via `parseMysteryDefinition` / API boot without errors  

---

## 20. Related docs

| Doc | Use when |
|-----|----------|
| [CASE_DEFINITION.md](./CASE_DEFINITION.md) | Design rationale, state philosophy |
| [CASE_STUDIES_CLASSICS.md](./CASE_STUDIES_CLASSICS.md) | Christie/Holmes structure maps |
| [TURN_PIPELINE.md](./TURN_PIPELINE.md) | Runtime director → engine → performer |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System-wide design |
| Blackwood `definition.json` | Canonical worked example |

---

## 21. Validation

From the monorepo:

```bash
# Regenerate JSON Schema for editors
pnpm schema

# Shared package parses Blackwood in tests
pnpm --filter @mystery/shared test

# Or in Node after build:
# parseMysteryDefinition(JSON.parse(fs.readFileSync("content/cases/.../definition.json")))
```

| Layer | What it catches |
|-------|-----------------|
| **JSON Schema** (`definition.schema.json`) | Shape, types, enums, required fields (editor + most IDEs) |
| **Zod `parseMysteryDefinition`** | Same + id cross-refs (exits, evidence, relationships, time slots) |

Invalid ids (exits, starting evidence, relationship endpoints, etc.) fail Zod `superRefine` checks at load time. JSON Schema does not re-implement every cross-ref — always run Zod parse / tests before shipping a case.
