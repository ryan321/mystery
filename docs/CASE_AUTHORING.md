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

### Character motivation (core craft)

People in a mystery are not clue dispensers. They have **goals** and **reasons**. That is part of the craft, not decoration.

| Cast weight | Motivation depth |
|-------------|------------------|
| **Main cast** (guilty, primary suspects, key allies, player-facing power holders) | **A lot.** What they want tonight, what they fear, what they will protect, what they will sell out. Enough that their lies, silence, and late turns feel earned. |
| **Secondary** | A clear spine: job, loyalty, fear, greed — enough to steer dialogue and one meaningful choice. |
| **Background / functional** | A little: why they are here and what they will not risk. |

Author motivations into:

- `shortBio` / voice / defenses  
- knowledge gates (what they protect, and under what pressure they talk)  
- relationships and willingness  
- beats (when goals clash with the player’s pressure)

The AI can color performance; **you** own *why* Vale panics, why Ada has keys and when she uses them, why June helps only through paperwork.

### Ending & resolution are design, not afterthought

Design **how the night ends** while you design the crime — not as a last-minute epilogue sticker.

The resolution path is part of the mystery the same way the body and the alibis are. Ask early:

1. **What does “winning” look like in this world?** (custody, board restored, undock, dinner, morning rounds…)  
2. **What forces make that possible?** (schedule, weather, hierarchy, evidence, player skill)  
3. **Which motivations fire?** (self-preservation, conscience, duty, revenge, love of a friend)  
4. **What can the player do that is not “wait for an NPC to flip”?**

NPC help is **one** valid pattern — not the only one. Examples of designed resolution:

| Pattern | Example |
|---------|---------|
| **Ally flips** | Ada uses keys after the forge is on her neck |
| **Institutional clock** | County boat / morning rounds / roads open at dawn |
| **Player agency** | Player realizes the “medicine” is keeping her weak, switches or refuses the dose, regains strength to act — *if* that is authored (inspectable, flag, beat) |
| **Public pressure** | Formal accusation in earshot of someone who must log or report |
| **Culprit’s goal backfires** | Their need to control the narrative forces a visible move |

Any of these can underwrite return-to-normal. Mix them. What matters is that **the ending was considered in the mystery design** so the rebalance is credible when it happens.

### Return to normal (default win craft)

**Solved ≠ quiz correct. Solved = the truth sticks and the world turns.**

Most mysteries need **two** layers of victory:

1. **Epistemic win** — the accusation scores (who / how / why per the rubric).  
2. **Dramatic win** — a **return to normal** that fits *this* story: authority arrives, the board is restored, the road opens, morning rounds, the kid gets home for dinner, the station undocks under company control. Think the FBI at the end of *Clue* — not only the correct name, but the world rebalancing around it.

| Outcome | What the player should feel |
|---------|-----------------------------|
| **Success** | Truth is public (or about to be); danger to the investigation ends; order begins to restore |
| **Partial** | Enough pressure to stop the night’s worst harm; full justice still needs daylight / lawyers / a thin file |
| **Failure** | The lie reasserts — sedation, transfer, roads empty, killer walks, storm ends for everyone else |

#### Diegetic, not magical

Return-to-normal must be **caused by the story** — people and their motivations, institutions, clocks, player actions, and evidence already in the world — not by the scoring system.

**Bad:** “You named the killer correctly, so the straps fall off / the door unlocks / the police appear for no reason.”  
**Good (NPC path):** “Ada flips to save herself, uses the keys on her ribbon, and frees you; June logs the true intake and rings for morning rounds.”  
**Good (player path):** “You learned what they put in the cup; you switched or refused it; strength returns; *you* force the door or hold until rounds — because the case authored that weakness and that choice.”

Bake the resolution path into the mystery (choose what fits; more than one path is fine):

| Question | Author it |
|----------|-----------|
| **What ends the crisis?** | Custody, open file, restored board, dinner table, undock… |
| **Who or what has power to change status?** | Keys, rank, phone, boat, meds, codes, parents, *the player’s body* |
| **Why does that power fire now?** | Character goals, fear, conscience, schedule, player discovery |
| **What did the player do to enable it?** | Present, flip, wait, switch the dose, hold a formal charge, steal a key… |
| **What still cannot change yet?** | Snow, storm, sealed lock — name the limit |

The wrap beat may *apply* engine effects (`release_player`, moves, flags), but **`narrationHints` and ending notes must name the cause** (whose goal, what clock, what player act). No silent “because success.”

**Author every success/lucky ending** with a concrete, **motivated** rebalance in `templateNotes` (and usually a denouement wrap beat).

**Exceptions (explicit override):** A case may withhold full freedom (still locked in until dawn, still snowed in). That is fine **if** the epistemic win is real, **something in-world** changes the balance for a written reason, and notes say why full exit waits.

Do **not** ship a success that only says “you were right” with no world change — or a world change with no cause. That is not a win for this product.

Wire it through:

| Piece | Role |
|-------|------|
| Character goals | Why people help, hinder, flip, or stand down |
| Investigation beats | Player discoveries and pressures that *enable* rebalance |
| `endings[].templateNotes` | Spine: confession **and** how resolution actually happens |
| `wrapUp.performanceNotes` | Aftermath tone + diegetic rebalance |
| Denouement beats | Engine state matching those causes |

### File layout

```
content/cases/
  definition.schema.json          # generated JSON Schema (autocomplete)
  <case-id>/
    definition.json               # your case — point $schema at ../definition.schema.json
```

At the top of each definition:

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

### Motivations (write them, even if informal)

For each **main** character, know before you ship:

| Prompt | Example |
|--------|---------|
| **Want** | Keep the fraud buried; get Nightwing back; hold the pier job |
| **Fear** | Exposure; losing the job; the pass never opening |
| **Line they will not cross (or will)** | Kill again; hurt a child; countersign a forge |
| **What the player can press** | Letter, syringe, friendship, money |

Encode as much as the format allows (`shortBio`, `defenses`, knowledge `content`, relationship labels, beat `narrationHints`). Put deeper notes in `canon.notes` if needed. Secondary cast gets a lighter version of the same.

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
  "templateNotes": "Culprit breaks. RETURN TO NORMAL: custody when the roads open / authority arrives / the sealed threat ends. Do not invent unfound proof.",
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

**`templateNotes` for success / lucky / partial** must include:

1. How the culprit reacts (confess, rage, fold)  
2. **Return to normal** — what rebalances (see product stance above)  
3. Lucky path: do **not** invent evidence the player never found  

Failure `templateNotes` should invert rebalance: the system closes, the lie holds, or the killer walks.

---

## 13. Wrap-up (denouement)

```json
"wrapUp": {
  "enabled": true,
  "maxTurns": 10,
  "allowEarlyExit": true,
  "performanceNotes": "After judgment: interactive aftermath. Stage RETURN TO NORMAL (authority, release, restored order). Stay second person; mystery is decided."
}
```

After accuse/fail beat: status becomes **`denouement`** (still interactive), then **`solved`/`failed`** when turns run out or player leaves.

Aftermath beats use:

```json
"when": { "type": "in_denouement" }
```

combined with `resolution_outcome` / `resolution_kind`.

Prefer a **success wrap beat** that:

- Applies state only when a **story agent** justifies it (e.g. `release_player` because Ada uses her keys after flipping — not because the score is green)  
- Moves or unmasks the guilty for motivated reasons  
- Opens key witnesses who already had a path in investigation  
- `narrationHints` that name **who did what and why** (morning rounds, county boat, roads opening, board restored)

Set `wrapUp.enabled: false` only when a hard cut is intentional (rare).

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

## 18. Player surfaces & opening package (author these too)

The player does not share the protagonist's ambient knowledge. A novel's
author narrates it as needed; a case must **ship** it. Rationale and UI
stance: [PLAYER_SURFACES.md](./PLAYER_SURFACES.md). The rule: **ambient
knowledge is free; discoveries are earned.**

### Opening package (required)

Match the diegetic form to the premise:

| Premise | Package |
|---------|---------|
| Professional (inspector, PI, journalist) | Case file / dossier / telegram / letter of engagement |
| Invited outsider (guest, summoned relative) | The invitation + what you know of the household |
| **Accidental** (ordinary person stumbling into a mystery) | No file — *lived familiarity*: your own house, street, coworkers, written as "what you already know" |

It must orient without spoiling: who you are, why you are here, the incident
(if known at start), who you already know and how, the setting basics.
Encode today in `meta.premise` + `player.startingKnowledge` +
`openingNarration` (structured `briefing` field planned).

### Spatial knowledge (map seed + fog of war)

- Decide what the character already knows spatially. A local knows the whole
  house before turn one; a stranger knows the entrance hall. Set
  `knownAtStart: true` per location to seed the fog-of-war map (Blackwood:
  the inspector is told where everyone is, so the main rooms start known);
  optional `map: {x, y, floor}` coordinates drive the sketch layout, and
  the `reveal_location` effect adds unvisited places when the story names
  them.
- The map reveals over time: visits, plus story reveals ("the ice house is
  past the kitchen garden"). Secret areas stay off the map until discovered.
- Write location `description`s so exits are *perceivable* — name the doors
  and directions. The scene panel and the performer both draw on them.

### Cast front matter

Review every relationship's `knownToPlayerByDefault` against the persona:
what would *this* protagonist already know socially? A village doctor knows
everyone; a hired PI knows nobody. These edges are the dramatis personae.

### Character identity & profiles

Character knowledge is a **three-stage ladder**, each stage authorable:

> **unknown** (player doesn't know they exist) → **known, unnamed**
> ("the groundskeeper") → **named** ("Old Tom Barrow")

Decide **per character** how the player first knows them:

- **Name known** (dinner-party introductions): profile starts with name +
  role line.
- **Label only** (White Room-style): the player knows them as "Orderly" or
  "the woman in 3B" until a story moment reveals the name. The performer
  and all UI use the known label — the real name never appears early.
- **Hidden** (`knownAtStart: false`): the character does not exist for the
  player — absent from the mystery detail page, cast lists, packs, and
  PlayerView — until they enter the story. Author their portrait, motives,
  knowledge, and relationships as usual; nothing leaks early.

**How hidden characters enter — the `entrance` field:**

```jsonc
{
  "id": "constable-reed",
  "name": "Constable Reed",
  "knownAtStart": false,
  "entrance": {
    "when": { "type": "time_at_least", "slotId": "after_midnight" },  // full condition language
    "mode": "appear",                    // appear = arrives in the world
    "atLocationId": "entrance-hall",
    "announce": "A hammering at the storm door: a constable, soaked through."
  }
}
```

- `mode: "appear"` — they become known, available, and physically present
  at `atLocationId` (the engine compiles this into a once-only beat; the
  performer stages the arrival from `announce`). Until then they are
  offstage (unavailable) automatically.
- `mode: "mention"` — the player learns they *exist* (cast list grows)
  without them appearing anywhere: hearsay, a letter, a name overheard.
- Other reveal routes: the `reveal_character` effect on any beat/knowledge
  moment, and **meeting them** (walking into their room reveals them).
- Gate beats on it with the `character_known` condition.
- Rules: never name a hidden character in opening prose (premise,
  narration, briefing, location descriptions — the bundle lint flags it),
  and `knownToPlayerByDefault` relationships cannot reference them
  (schema-rejected).

The expandable profile is a **dramatis personae entry, not a growing dossier**:
portrait, known name/label, title, and a brief authored outline
(`shortBio`, including any starting-known relationships: "the victim's
business partner"). It exists to keep the characters straight and **never
accumulates learned facts** — discoveries live in prose and the notebook.
Author for this: write each `shortBio` as front matter (orienting, not
spoiling); plan the name-reveal moment for label-only characters; and give
accusation `matchHints` the role label too — the engine also matches
`introducedAs` labels automatically, so "the orderly did it" scores when
the name is still unknown. Fields: `introducedAs`, `nameKnownAtStart`;
effects: `reveal_character_name`, `set_known_as`; condition:
`character_name_known`. **Write all case prose (descriptions, hints,
knowledge, beats) without the real name of any label-only character** —
the engine hides the name in packs and UI, but authored text is shipped
verbatim.

### Imagery (optional)

Portraits, cover, location establishing shots are authored **offline** in
the case pipeline and reviewed for spoilers (an image must not show an
undiscovered clue). Never generated at runtime.

---

## 19. Authoring workflow (recommended order)

1. **Crime** — `canon.timeline` + `solution` (sealed envelope).  
2. **Motivations** — main cast wants/fears/lines; secondary spines.  
3. **Resolution design** — how the night ends if the player wins (and fails): who/what/why, including player-agency paths if any.  
4. **Stage** — locations, exits, starting cast positions.  
5. **Player surfaces** — opening package, starting spatial knowledge (map fog seed), cast front matter (§18).  
6. **Discoveries** — evidence + inspectables that grant them (include anything the resolution needs, e.g. the real medicine).  
7. **Cast knowledge** — public / private / secrets with gates.  
8. **Relationships** — who is bound to whom; what stays private.  
9. **Spine beats** — discovery → deepening → pressure → accuse.  
10. **Failure beats** — wrong accuse, time, threat clocks, arrest.  
11. **Wrap-up beats** — denouement that executes the resolution you designed (diegetic causes).  
12. **Endings** — distinct `templateNotes` per outcome/kind; success names how rebalance happens.  
13. **Playtest** — condition chains; feel (does winning *feel* like winning for *this* story?).  
14. **Three-clue rule** — each required claim reachable ≥2 ways when possible.

Think: **when X becomes true → state changes → new possibilities.**

---

## 20. Checklist before shipping a case

- [ ] `schemaVersion` `1.5`, unique `id`, bumped `contentVersion`  
- [ ] All location/exit/character/evidence ids consistent  
- [ ] Player start location exists  
- [ ] Every required rubric fact has solid `matchHints`  
- [ ] Success ending + ≥1 failure ending  
- [ ] Main cast have clear **motivations** (want / fear / line); secondaries have at least a spine  
- [ ] **Resolution designed early** — not only “accuse scores”; how the world rebalances fits *this* mystery  
- [ ] **Return to normal** on every success/lucky ending (and a scaled version on partial); exceptions documented in wrap notes  
- [ ] Rebalance is **diegetic**: people, goals, clocks, or authored player agency — never “magic unlock because correct accuse”  
- [ ] Denouement / wrap beat implements that designed resolution  
- [ ] Critical discovery chain has beats (`on_discover` / `on_present` as appropriate)  
- [ ] Failure clocks/time use `on_turn` + `case_active`  
- [ ] Denouement beats gated with `in_denouement`  
- [ ] Secrets never only reachable by AI invention (gates or reveal effects)  
- [ ] Opening narration + starting knowledge don’t spoil the solution  
- [ ] **Opening package** authored and matched to the premise (dossier / invitation / lived familiarity for accidental protagonists) — §18  
- [ ] **Starting spatial knowledge** matches persona familiarity (map fog seed); secret areas stay unknown until discovered  
- [ ] Location descriptions name their exits/doors (scene panel + performer draw on them)  
- [ ] `knownToPlayerByDefault` relationship edges reviewed against the persona (village doctor vs hired stranger)  
- [ ] Per-character identity decided: name known at start vs label-only ("Orderly"), with a reveal moment authored for label-only characters  
- [ ] Accusation `matchHints` cover role labels for name-unknown characters ("orderly")  
- [ ] Imagery (if any) authored offline and spoiler-reviewed  
- [ ] Loads via `parseMysteryDefinition` / API boot without errors  

---

## 21. Related docs

| Doc | Use when |
|-----|----------|
| [CASE_DEFINITION.md](./CASE_DEFINITION.md) | Design rationale, state philosophy |
| [PLAYER_SURFACES.md](./PLAYER_SURFACES.md) | Ambient knowledge, opening package, map / fog of war, UI stance |
| [MYSTERY_BUNDLES.md](./MYSTERY_BUNDLES.md) | Packaging a mystery as a bundle (zip), publishing, access/unlock policy |
| [CASE_STUDIES_CLASSICS.md](./CASE_STUDIES_CLASSICS.md) | Christie/Holmes structure maps |
| [TURN_PIPELINE.md](./TURN_PIPELINE.md) | Runtime director → engine → performer |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System-wide design |
| Blackwood `definition.json` | Canonical worked example |

---

## 22. Validation

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
