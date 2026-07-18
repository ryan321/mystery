# Case studies: Christie & Holmes in our definition format

**Date:** 2026-07-18  
**Goal:** Stress-test whether famous fair-play mysteries can be well represented as interactive cases (not page-for-page novels).  
**Format reference:** [CASE_AUTHORING.md](./CASE_AUTHORING.md) (fields) · [CASE_DEFINITION.md](./CASE_DEFINITION.md) (design)

---

## How to read these studies

For each story we ask:

1. **Closed world?** Can we bound locations and cast?  
2. **Canon?** Is the sealed truth clear?  
3. **Discovery graph?** Clues, interviews, presents?  
4. **Dynamics?** Time, pressure, willingness, plot beats?  
5. **Win condition?** What must the player establish?  
6. **Gaps?** What does our format struggle with?

---

# 1. Agatha Christie — *Murder on the Orient Express* (1934)

## Why this one

- Closed circle (train in snow)  
- Multiple suspects, layered alibis  
- Physical clues + interviews  
- Famous twist: **many (or all) culprits**  
- Natural phases: discovery → interviews → reconstruction → accusation  

If Orient Express works, most Christie closed-circle books work.

## 1.1 Adaptation stance (important)

We are **not** “playing the novel.” We adapt it into:

- Player persona: **Poirot** (or a consulting detective in his role)  
- One continuous investigation on the stalled train  
- Freeform talk/inspect; engine owns truth and major plot turns  
- Spoiler-aware: solution only in `solution` / ending evaluator  

Optional: rename characters for a “inspired by” case if rights are a concern; structure below is the *story shape*.

## 1.2 Closed world

### Locations (sketch)

| id | Name | Notes |
|----|------|--------|
| `dining-car` | Dining car | Social hub |
| `corridor-istanbul` | Corridor (Istanbul–Calais coach) | Access to compartments |
| `comp-ratch` | Victim’s compartment | Crime scene |
| `comp-poirot` | Player’s compartment | Briefing / notes |
| `comp-hardman` | Hardman’s compartment | |
| `comp-hubbard` | Hubbard’s compartment | |
| … | One location per key passenger | Or group minor NPCs |
| `kitchen` | Kitchen | Staff |
| `platform-snow` | Outside in the snow | Limited; footprints |

**Exits:** linear coach graph + dining car; `platform-snow` only if beat allows (“examine outside”).

**Environment defaults:**

```json
"environment": {
  "weather": "snow",
  "weatherIntensity": "blizzard",
  "light": "lamplight",
  "ambient": "claustrophobic",
  "crowd": "none"
}
```

**Time schedule (investigation night → morning):**

| slotId | label | Role |
|--------|--------|------|
| `body_found` | Body discovered | Start |
| `first_interviews` | First round of interviews | |
| `clues_mount` | Mid investigation | |
| `before_dawn` | Before dawn | Pressure |
| `dawn_arrival` | Approaching Brod station | Optional clock end |

`minutesPerTurn: 10–15` so the night “gets late” even without big finds.

## 1.3 Cast (compressed but faithful)

| id | Public face | Private / conditional | Secret (gated hard) |
|----|-------------|------------------------|---------------------|
| `ratch` | Victim (dead) | — | Identity: gangster who ruined a child/family |
| `poirot` | Player | startingKnowledge only | — |
| `boucher` | Train staff | Saw movement in corridor | |
| `macqueen` | Secretary | Relationship to victim | |
| `arbuthnot` | Colonel | Alibi with someone | |
| `hubbard` | Elderly American | Button, noise story | |
| `hardman` | Detective / tough | Past as detective | |
| `andersson` | Missionary / governess type | Trauma link | |
| `dragomiroff` | Princess | Connection to family | |
| `schmidt` | Maid | Loyalty | |
| `foscarelli` | Car salesman | Temper | |
| `masterman` | Valet | Timing | |
| `dibenetto` | etc. | … | |
| `constantine` | Doctor | Medical facts (public) | |

**Character state defaults:** most `willingness: guarded`; staff `open` on procedure; some `hostile` if pressed early.

**Presence:** many start in own compartments; beats can “summon to dining car.”

## 1.4 Evidence (examples)

| id | How found | Proves / suggests |
|----|-----------|-------------------|
| `broken-watch` | Victim’s compartment | Time of attack disputed |
| `handkerchief-H` | Crime scene | Initial false lead |
| `uniform-button` | Crime scene | Conductor disguise theory |
| `burned-paper` | Ash | Partial name / note |
| `footprints-snow` | Outside | Number of people? red herring |
| `passenger-list` | Given at start | Closed cast |
| `scars-or-photo` | Later search / interview | Victim’s true identity |
| `weapon-options` | Knife from kitchen / etc. | Method |

## 1.5 Canon (sealed)

```text
timeline (crime night):
  - Train stopped in snow
  - Victim killed in compartment by multiple blows
  - Staged “intruder from outside” using snow / window
  - Passengers coordinate stories (to varying degrees)

solution:
  culpritIds: [all_conspirators...]  // or primary stabbers + accessories
  method: multiple stab wounds; conspiracy
  motive: vengeance for a child’s murder / Daisy Armstrong analogue
  summary: ...
```

**Our format supports multi-culprit** via `guiltyPartyIds: [...]` and rubric claims like:

- Victim’s true identity established  
- Intruder-from-outside is false  
- Conspiracy among passengers  
- Motive = revenge for the child  

## 1.6 Story beats (investigation plot)

| Beat id | When | Effects (sketch) |
|---------|------|------------------|
| `body_examined` | inspect crime scene thoroughly | grant watch, handkerchief, button; phase → interviews |
| `identity_hint` | has burned-paper OR hardman_talk | unlock knowledge about victim’s past |
| `false_lead_H` | present handkerchief to princess | red herring; pressure on wrong person |
| `hardman_admits` | present identity evidence to hardman | reveal he was hired detective; willingness open |
| `corridor_noise` | talked to hubbard + boucher | knowledge alignment; flag corridor_activity |
| `assemble_dining` | phase deepening + turn≥N OR player request | move most cast to dining-car; set_piece |
| `midnight_pressure` | time_at_least before_dawn | environment ambient more tense; some willingness guarded |
| `wrong_single_killer` | accuse only one random passenger without conspiracy claims | partial or failure + cast hostility |
| `correct_conspiracy` | accuse with multi-culprit + motive + false-intruder | success ending |

**Chain example:**

```
examine compartment
  → evidence (button, watch, handkerchief)
  → interviews
  → present identity clue
  → Hardman opens up
  → conspiracy theory becomes available knowledge
  → assemble cast
  → accuse
```

## 1.7 Player win condition

Player should establish roughly:

1. Who the victim really was  
2. That the “lone outsider” story is false  
3. That multiple passengers share guilt (or the full jury)  
4. Motive (child / family vengeance)  

Ending templates:

- **success:** full reconstruction, moral ambiguity acknowledged  
- **partial:** names one stabber, misses conspiracy  
- **failure:** pins only the red herring  

## 1.8 Fit score — Orient Express

| Criterion | Score | Notes |
|-----------|-------|--------|
| Closed world | ★★★★★ | Train is ideal |
| Interviews + alibis | ★★★★★ | Knowledge + time |
| Physical clues | ★★★★★ | Evidence graph |
| Multi-culprit twist | ★★★★★ | `guiltyPartyIds` |
| Red herrings | ★★★★☆ | Beats + false present paths |
| Ensemble finale | ★★★★☆ | Needs assemble beat (expressible) |
| Literary monologue length | ★★★☆☆ | Ending notes + performer; not a 40-page chapter |
| Rights / spoiler product | — | Structure yes; publish carefully |

**Verdict:** **Very well represented.** This is nearly a perfect match for our format.

---

# 2. Arthur Conan Doyle — *The Adventure of the Speckled Band* (1892)

## Why this one

- Single primary culprit (clear solution)  
- Manor locations + deadly mechanism  
- Object-state puzzle (bed, ventilator, bell-rope, safe)  
- **Time:** night vigil; danger at a certain hour  
- Client interview → scene examination → experiment/confrontation  

Classic Holmes short story = good stress test for **objects + time + single villain**.

## 2.1 Adaptation stance

- Player = **Holmes** (or consulting detective)  
- Optional NPC: **Watson** (can be silent companion or limited dialogue)  
- Client: **Helen Stoner**  
- Antagonist: **Dr. Grimesby Roylott**  
- Setting: London rooms (brief) + Stoke Moran manor  

Can collapse London to a short prologue location or start already at the manor.

## 2.2 Closed world

### Locations

| id | Name | Notes |
|----|------|--------|
| `baker-street` | Baker Street (optional) | Client interview start |
| `manor-grounds` | Manor grounds | Cheetah/baboon atmosphere (environment/wildlife) |
| `hall` | Main hall | |
| `helen-room` | Helen’s current bedroom | |
| `julia-room` | Sister’s old room / death room | Central puzzle |
| `roylott-room` | Roylott’s room | Safe, ventilator |
| `corridor` | Corridor connecting rooms | |

**Exits:** manor graph; Roylott’s room may start locked or accessible only when he’s away (beat / time / character location).

**Environment:**

```json
"environment": {
  "weather": "clear",
  "light": "day",  // becomes night during vigil
  "ambient": "menacing",
  "crowd": "none",
  "flags": { "exotic_animals_loose": true }
}
```

Pulse: baboon/cheetah scare on grounds (`pulse_environment` or move threat).

**Time schedule (critical for this story):**

| slotId | label | Role |
|--------|--------|------|
| `afternoon_arrival` | Afternoon at manor | Examine rooms in daylight |
| `evening` | Evening | Roylott present / tension |
| `night_watch` | Night vigil | Player waits in sister’s room |
| `deadly_hour` | The hour of the band | Snake deployed |
| `resolution` | After the lamp / whistle | Confrontation |

Mechanisms:

- Examining rooms does **not** have to jump time  
- Beat or explicit “I will watch tonight” → `advance_time` to `night_watch`  
- Passive minutes during vigil OR beat `deadly_hour` after N turns in `julia-room` at night  

This is exactly **Colonel’s Bequest-style** (action advances time) **plus** schedule danger.

## 2.3 Cast

| id | Default willingness | Role |
|----|---------------------|------|
| `helen` | open | Client; fearful; key testimony |
| `roylott` | hostile | Stepfather; intimidation; physical threat |
| `housekeeper` | guarded | Minor logistics |
| `watson` | open | Optional; can “hold lamp” as flavor NPC |

**Character state dynamics:**

- Roylott starts **hostile**; after player is seen at manor, beat may move him to threaten Holmes (canonical visit to Baker Street can be a prologue beat).  
- Helen remains **open** but pressure rises at night.  
- If player accuses Helen’s imagination → she may go **guarded**.  

## 2.4 Objects / evidence (the puzzle core)

| id | Object/evidence | State & discovery |
|----|-----------------|-------------------|
| `ventilator` | Dummy ventilator between rooms | inspect julia-room + roylott-room |
| `bell-rope` | Dummy bell-pull | inspect; doesn’t ring |
| `bolted-bed` | Bed clamped to floor | inspect |
| `saucer-of-milk` | In Roylott’s room | inspect |
| `safe` | Iron safe | locked object; whistle association |
| `dog-lash` | Loop/lash | evidence of control |
| `whistle-sound` | Heard at night | beat/environment pulse, not inventory |
| `speckled-band` | Snake (truth object) | revealed at deadly hour / resolution |

**Object state examples:**

- `safe`: locked until resolution or never player-opened  
- `bell-rope`: examined → flag `knows_dummy_bell`  
- Bed: examined → flag `knows_bed_fixed`  

**Win-facing claims:** player must connect ventilator + rope + bed + Roylott’s room + motive (inheritance).

## 2.5 Canon (sealed)

```text
timeline:
  - Stepfather controls stepdaughters’ inheritance
  - Sister killed by venomous snake sent through ventilator along bell-rope
  - Helen moved to same room; same attack planned
  - Holmes waits at night; snake driven back; Roylott killed by his own snake (or arrested variant for game rating)

solution:
  culpritIds: ["roylott"]
  method: snake ("speckled band") via ventilator and dummy bell-rope
  motive: prevent marriages / keep inheritance
```

**Game rating choice:**  
- Literary ending (Roylott dies by snake) = success ending variant  
- Softer: snake bagged, Roylott arrested  

Both fit `endings[]`.

## 2.6 Story beats

| Beat id | When | Effects |
|---------|------|---------|
| `client_story` | start / talk helen | knowledge: sister’s death, whistle, metallic clang, inheritance |
| `examine_death_room` | inspect ventilator+rope+bed (flags) | phase deepening; notebook facts |
| `roylott_threat` | turn≥N OR visited manor | `set_player_threat(threatened)`; optional move Roylott; environment menacing |
| `decide_night_watch` | player says will watch OR time advance action | `advance_time` → night_watch; light night; move player allowed in julia-room |
| `deadly_hour` | time_at_least deadly_hour AND player in julia-room | pulse whistle; grant understanding; set phase crisis |
| `snake_returns` | deadly_hour fired + player “strikes / lights lamp” intent | end threat; reveal method knowledge; Roylott outcome effect |
| `wrong_gypsies` | accuse “band of gypsies” only | failure/partial — classic red herring from Helen’s words |
| `correct_solution` | accuse Roylott + snake/ventilator/rope + motive | success |

**Chain:**

```
Helen’s story
  → examine sister’s room (bed, rope, ventilator)
  → examine Roylott’s room (safe, milk, lash)
  → choose night vigil (time jump)
  → deadly hour beat
  → confront method
  → accuse / resolve
```

## 2.7 Player win condition

Required claims (rubric):

1. Culprit is Roylott  
2. Method involves snake / speckled band through ventilator  
3. Dummy bell-rope / fixed bed part of mechanism  
4. Motive inheritance / prevent marriage  

Red herring claim: “gypsies did it” → failure or scolding partial.

## 2.8 Fit score — Speckled Band

| Criterion | Score | Notes |
|-----------|-------|--------|
| Manor closed world | ★★★★★ | Small map |
| Object-state puzzle | ★★★★★ | Bed/rope/ventilator/safe |
| Time as danger | ★★★★★ | Night vigil + deadly hour |
| Single culprit | ★★★★★ | Clean rubric |
| Client interview | ★★★★★ | Knowledge beats |
| Animal atmosphere | ★★★★☆ | Environment + pulses |
| Action climax | ★★★★☆ | Beat + performer; not action combat |
| Holmes “brilliance” feel | ★★★★☆ | Player must connect clues; AI shouldn’t spoon-feed |

**Verdict:** **Very well represented** — arguably even cleaner than Orient Express for our engine, because object state + time danger are first-class in our design.

---

# 3. Side-by-side comparison

| Feature in format | Orient Express | Speckled Band |
|-------------------|----------------|---------------|
| Locations | Many small (compartments) | Few rich rooms |
| Cast size | Large | Small |
| Evidence count | Medium–high | Medium |
| Knowledge interviews | Dominant | Important but secondary to objects |
| Time | Night-long investigation | Critical night mechanism |
| Environment | Snow, stalled train | Storm optional; animals; night |
| Culprits | Many | One |
| Beats complexity | High (social web) | Medium (clear spine) |
| Risk of AI freestyle | High if cast underspecified | Medium if objects underspecified |
| Authoring cost | High | Medium |
| Fit to format | Excellent | Excellent |

---

# 4. What both stories prove about our format

### Already sufficient (conceptually)

1. **Closed fair-play whodunit** — both stories  
2. **Multi-culprit conspiracy** — Orient Express  
3. **Mechanical “impossible” crime** — Speckled Band  
4. **Interview + evidence present loops** — both  
5. **Time-gated danger / schedule** — Speckled Band especially  
6. **Red herrings** — handkerchief “H”; “gypsies / speckled band” misread  
7. **Willingness / pressure** — Roylott hostile; passengers guarded → cracked  
8. **Detective as target** — Roylott threatens Holmes; room/safe-haven pressure via `playerStatus` + off-screen beats  

### Needs careful authoring (not missing primitives)

- Large casts (Express): every passenger needs *enough* public/private beats or they’ll feel empty  
- Ensemble finale: implement as a **beat that relocates cast**, not a new system  
- Holmes’s leap of insight: must be **supported by inspectable facts** so players can recreate it  

### Still weaker / optional extensions

| Gap | Story that stresses it | Mitigation |
|-----|------------------------|------------|
| Long monologue denouement | Orient Express | Long ending templates + performer |
| Negative clue (“dog did nothing”) | Other Holmes tales | Author as explicit knowledge/inspect fact |
| Unreliable narrator | Ackroyd | Out of scope |
| Pure chase / action | Some Holmes | Narrative beats only |

---

# 5. Could we build them as real `definition.json` files?

| Story | Feasible as interactive case? | Est. content size |
|-------|-------------------------------|-------------------|
| Orient Express | **Yes** | Large: 10–15 locations, 10–15 characters, 15–25 evidence, 15–25 beats |
| Speckled Band | **Yes** | Medium: 5–7 locations, 3–5 characters, 8–12 evidence, 8–12 beats |

Speckled Band is the better **second official case** after Blackwood (teaches object+time).  
Orient Express is a strong **flagship showcase** once authoring tools exist.

---

# 6. Minimal skeleton comparison (shape only)

### Orient Express (skeleton)

```text
meta: closed train, snow
player: Poirot-like
locations: dining, corridor, victim_comp, N passenger comps, kitchen, snow
characters: victim(dead), 8–12 passengers, 2 staff
evidence: watch, handkerchief, button, burned note, footprints, identity proof
time: body_found → interviews → before_dawn
environment: snow, stalled, claustrophobic
beats: body_examined, false_lead_H, identity_reveal, hardman_opens,
       assemble_dining, wrong_lone_killer, success_conspiracy
solution.guiltyPartyIds: [multiple]
```

### Speckled Band (skeleton)

```text
meta: manor, inheritance, night danger
player: Holmes-like
locations: grounds, hall, helen_room, julia_room, roylott_room, corridor
characters: helen, roylott, housekeeper, (watson)
evidence: ventilator_fact, dummy_bell, bolted_bed, milk_saucer, lash, whistle_event
time: afternoon → evening → night_watch → deadly_hour
environment: menacing, optional animal pulse
beats: client_story, examine_death_room, examine_roylott_room,
       start_vigil, deadly_hour, snake_resolution, wrong_gypsies, success
solution.guiltyPartyIds: [roylott]
```

Both skeletons map onto **schema 1.5+** (locations, characters, evidence, flags/beats, time, environment, solution, endings) without inventing a new product type.

---

# 7. Final answer

| Question | Answer |
|----------|--------|
| Can a famous **Christie** story be well represented? | **Yes.** *Murder on the Orient Express* is an excellent match: closed world, interviews, clues, multi-culprit, time pressure. |
| Can a famous **Holmes** story be well represented? | **Yes.** *The Speckled Band* is an excellent match: object-state puzzle, night schedule, single culprit, client + confrontation. |
| Same format for both? | **Yes** — different *weights* (social web vs mechanical room), same primitives. |
| Any deal-breakers? | Not for these two. Deal-breakers appear for unreliable-narrator or sprawling non-closed epics. |

**Conclusion:** Our case definition format is not only “good enough for Blackwood-likes.” It can carry **flagship fair-play classics** if we adapt them as interactive cases: seal the canon, author the discovery graph and beats, and let the AI perform the night on the train or the vigil in the manor—not invent who done it.

---

## Suggested next step

Pick one to flesh into a full `content/cases/.../definition.json` after Blackwood is polished:

1. **Speckled Band** — faster to ship, proves time + objects  
2. **Orient Express** — bigger showcase, proves multi-culprit + ensemble  

Recommendation: **Speckled Band second, Orient Express third (or as a premium flagship).**
