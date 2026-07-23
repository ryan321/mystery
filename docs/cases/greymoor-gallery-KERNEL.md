# Greymoor Gallery — mystery kernel

**Status:** Kernel only (matches sealed story as given).  
**Date:** 2026-07-23  
**Guide:** [CREATING_MYSTERIES.md](../CREATING_MYSTERIES.md)

This supersedes earlier Greymoor drafts that invented accident/help-task plots. **This document follows the author’s truth below.**

---

## Working title

**Greymoor Gallery**  
*(working; mansion + upper gallery + midnight)*

---

## Disturbance

In an old mansion, the middle-aged nephew who helps run the household is found dead in the **great hall** after a midnight crash from the **upper gallery**. First story: he fell. Then: he was **shot**, and the bullet came **from below**. Someone fired upward from the hall. The house is full of contradictory sounds (shot? crash? one sound or two?). A **threatening note** about a midnight meeting on the gallery sits at the center of the case — and almost everyone misreads who wrote it and for whom.

## Stakes

- If unsolved as “accident” or pinned on the wrong person, the **granddaughter** may be destroyed (blame, silence, no protection).
- The **nephew’s** abuse and police protection stay buried.
- The **grandmother’s** act is both rescue and extrajudicial killing — the moral weight of the ending.

---

## Promise (case description — crime will happen / has happened)

> In a mansion run by trust and quiet power, a man dies under the gallery at midnight. A fall, a shot, a note, and a household that cannot agree what it heard. Someone will have to name the truth the police may not want to hear.

*(If pre-crime opening is used later: still promise that midnight will end in death.)*

---

## Sealed solution (as given)

### Cast of truth

| Role | Person |
|---|---|
| **House** | Old mansion; elderly woman (wheelchair) owns it; orphaned **granddaughter** lives with her |
| **Nephew** | Middle-aged, charming, respectable; manages household; **trusted**; **close to local police** |
| **Secret** | Nephew **threatens and physically abuses** the granddaughter; uses reputation + police friends so she believes no one will help; a prior complaint may have **reached him** and made things worse |
| **Killer** | **The elderly woman (grandmother)** — wheelchair user |
| **Protected** | Granddaughter |

### What happens that night

1. Nephew leaves the granddaughter a **threatening note**: meet him **alone on the upper gallery at midnight** — to intimidate/punish her and keep her silent.
2. **Grandmother finds the note**, sees immediate danger.
3. She believes **police will warn him**, not stop him (his friendships).
4. She **takes the granddaughter’s place** (the meeting is for the girl; the grandmother goes instead / acts in her stead from below).
5. Near midnight, nephew waits on the **upper gallery**.
6. Grandmother is **below in the dark great hall** with a **gun concealed in or about her wheelchair**.
7. She draws him to the **railing** and **shoots upward**.
8. He **falls** from the gallery onto the hall floor.
9. Death: fall, bullet, or **both**.

### Method (critical)

- She **never overpowers him** and **never throws him**.
- She **shoots from below**; gravity does the rest.
- Wheelchair underestimation: “she couldn’t throw a healthy man over a balcony” — correct, and **irrelevant**.

### Motive (critical)

- **Protective but morally complicated.**
- She kills a dangerous man to save her granddaughter.
- She chooses **execution** over escape, exposure, or legal process because she believes **authorities are already on his side**.

### The note (critical reversal)

| First reading (false) | Truth |
|---|---|
| Killer wrote the note **to the dead man** (lure him to the gallery to murder him) | **He wrote it himself** to **summon and threaten the granddaughter** |
| Note is bait by the murderer | Note is **his instrument of abuse**; grandmother intercepted it |

### False suspects / fog

- **Granddaughter:** supposed to meet him; hate and fear; hides abuse; may **lie to protect grandmother**.
- **Grandmother:** “can’t” have thrown him; may seem frail, devastated, impossible.
- **Sound witnesses:** some hear a **shot**, some only a **crash**, some **one** sound vs **two** — honest disagreement through walls, echoes, sleep — not necessarily liars.

---

## False appearance (the magic trick)

1. **Fall / accident** (first).  
2. Then **murder from the gallery** — someone up there with him, or he was pushed.  
3. **Note** = killer’s lure **to him**.  
4. **Granddaughter** = natural killer (meeting, motive, lies).  
5. **Grandmother** = physically impossible for the “balcony throw” theory.

**Reversal sequence for the player:**

```
Fall → shot from below
→ who was on the gallery and why (midnight meeting)
→ note was TO the girl FROM him, not bait TO him FROM killer
→ grandmother shot upward from the hall (chair / concealment)
→ motive: protect granddaughter; no faith in police
```

---

## Primary evidence chain (Plot A — how the player solves it)

**Authoritative order.** This is the spine the case must support. Soft order can vary slightly, but these are the load-bearing steps.

### Step 1 — Examine the body

| Find | Teaches |
|---|---|
| **Gunshot wound** | Not a pure fall / not only impact |
| **Wound geometry: shot from below** | Muzzle was in the **great hall**, firing **up** toward the gallery — not a gallery-level fight or push-only story |

**Player state after step 1:** Foul play + **shooter was downstairs**.  
“Someone threw him” and “duel on the gallery” collapse.

**Evidence ids (encode later):** `body-gunshot`, `trajectory-from-below` (or one examine that yields both).

---

### Step 2 — Note in the old lady’s fireplace

| Find | Teaches |
|---|---|
| **Charred but readable note** in **grandmother’s fireplace** | She had the note and tried to **burn** it; meeting text still legible (gallery, midnight, alone, threat tone) |

**Player state after step 2:** Someone was summoned to the gallery at midnight; **grandmother handled the note** (found it / tried to destroy it).  
First misread still available: “she wrote a lure to him” or “she burned his secret” — not fully solved yet.

**Evidence id:** `charred-note`  
**Location:** grandmother’s room — fireplace.

---

### Step 3 — Indentation pad in the victim’s room

| Find | Teaches |
|---|---|
| **Notepad on his desk** with **indentations** matching the charred note | **He wrote the note** (pressure of pen on the sheet beneath) |

**Player state after step 3:** Note is **his** instrument, not a killer’s bait **to** him. Combined with content, it was almost certainly **to the granddaughter** (orders/threat to her).  
**Keystone reversal** of the document.

**Evidence id:** `notepad-indentations`  
**Location:** victim’s room / desk.  
**Requires for full meaning:** player already has (or can compare to) `charred-note`.

---

### Step 4 — Granddaughter cracks (abuse + police + “I didn’t kill him”)

| Find | Teaches |
|---|---|
| **Testimony** (after trust / pressure / evidence presented — note + his authorship) | He **abused and threatened** her; she **went to the police**; they **did not believe her** (or it came to nothing / reached him); she is **adamant she did not kill him** |

**Player state after step 4:** Full **motive landscape** — why someone protective would act; why legal path failed; granddaughter is victim of the meeting, not a clean “lured him to shoot him” killer. She may still be lying about other things (protecting grandmother) but the abuse truth is out.

**Knowledge beat ids (encode later):** e.g. `granddaughter` / `abuse-revealed`, `police-failed`, `i-did-not-kill-him`  
**Gate:** do not give this dump on turn 1 — require note path and/or trust so cracking feels earned.

---

### Step 5 — Gun in the old lady’s room

| Find | Teaches |
|---|---|
| **The gun** hidden somewhere in **grandmother’s room** | Means; ties the downstairs shot to **her** space (and chair/concealment can be staged in fiction when found) |

**Player state after step 5:** Method + identity close.  
Shot from below + she had the note + he wrote it to threaten the girl + abuse/police failure + **her gun** → accuse: **grandmother shot him from the hall to save the granddaughter**.

**Evidence id:** `gallery-gun` (or `wheelchair-gun` if found with chair)  
**Location:** grandmother’s room (specific hide later: cabinet, under seat cushion, lined bag, etc.).

---

### Solve condition (Plot A complete)

Player can fairly name:

| Facet | From steps |
|---|---|
| **Method** | 1 + 5 (shot from below; her gun) |
| **Motive** | 2–4 (note, he wrote it, abuse, police useless) |
| **Identity** | 1 + 2 + 5 (downstairs shot, she had the note she tried to burn, gun in her room) |

Indentations (3) are what make the note reversal **airtight** without relying only on the girl’s word.

---

## Plot B — shady dealings (reinforce WHY, not required to win)

**Role:** Secondary clue chain. Explains **why he was dangerous beyond the household**, why grandmother might believe the system is rotten, and why the police friendship lands — **not** a second culprit.

| Find (examples) | Teaches |
|---|---|
| Ledgers, letters, black-book, coded payments in **his** room/study | Highly **illegal business dealings** |
| Granddaughter **knows fragments** (overheard, saw papers, was threatened to stay silent about *business* too) | She holds more than only personal abuse; fear is doubled |
| Optional: link between his **police friends** and looking the other way on business | Reinforces “reporting is futile” |

**Casebook:** optional lead *What else was he mixed up in?*  
**Scoring:** supporting / flavor for motive richness — **do not** require Plot B for full success if Plot A is complete (unless you later choose a strict `all_facts` policy).

**Keep Plot B from hijacking:** no alternate “mob hit from below” solution. Shady dealings **support** grandmother’s desperation and his power; they do not replace the protective-execution truth.

---

## Solution graph (final — encode as `deductions[]`)

Sealed claims never show to the player. Only **questions** surface as casebook leads when opened.

### Overview

```
                    ┌─ maid-wrist-fear ─────────────────────────────┐
                    │   (early arrow: he mistreats the girl)          │
                    ▼                                                 │
[1] not-simple-fall ──► [2] shot-from-below                           │
         │                      │                                     │
         │                      ▼                                     │
         │              method (terminal) ◄── [6] gun-in-her-room     │
         │                      ▲                                     │
         ▼                      │                                     │
[3] charred-note-found ──► [4] he-wrote-the-note                      │
         │                      │                                     │
         │                      ▼                                     │
         │              [5] girl-unlock-testimony ◄───────────────────┘
         │                 abuse, police failed, she didn't kill him
         │                 grandmother found out, "she'll handle it"
         │                      │
         │                      ▼
         └──────────► motive (terminal)
                            │
                            ▼
                    identity (terminal) ◄── shot-from-below
                                        ◄── charred-note-found
                                        ◄── gun-in-her-room
                                        ◄── girl: handle-it
```

Plot B (shady dealings) is **supporting only** — optional lead `what-else-was-he`, not required for terminals.

---

### Intermediate leads

#### `not-simple-fall`
| | |
|---|---|
| **Question** | Did he only fall, or was he shot? |
| **Claim (sealed)** | He was shot; not a pure accidental fall. |
| **Requires** | — (open after body can be examined) |
| **Supports** | `{ evidenceId: body-wound }` — gunshot on examine |
| **minSupports** | 1 |
| **Opens** | at case start or when player reaches hall/body |

#### `shot-from-below`
| | |
|---|---|
| **Question** | From where was the gun fired? |
| **Claim (sealed)** | From the great hall below, upward toward the gallery. |
| **Requires** | `not-simple-fall` |
| **Supports** | `{ evidenceId: body-wound }` — trajectory/entry from below (same examine or linked fact) |
| **minSupports** | 1 |
| **Feeds** | method, identity |

#### `maid-wrist-fear` *(early social lead)*
| | |
|---|---|
| **Question** | Was someone in the house afraid of him for a reason? |
| **Claim (sealed)** | He mistreated the granddaughter; she is terrified of him. |
| **Requires** | — |
| **Supports** | `{ knowledge: maid / saw-wrist-grip }` — maid: he gripped the girl’s wrist hard once; girl is terrified of him |
| **minSupports** | 1 |
| **Feeds** | girl unlock context; motive (soft) |
| **Note** | Does not prove murder; points **him → her** |

#### `charred-note-found`
| | |
|---|---|
| **Question** | Why is there a half-burned note about a midnight gallery meeting in the old lady’s fireplace? |
| **Claim (sealed)** | Grandmother had the threatening note and tried to destroy it; a midnight gallery meeting was ordered. |
| **Requires** | — (or soft: after `not-simple-fall`) |
| **Supports** | `{ evidenceId: charred-note }` — fireplace in grandmother’s room |
| **minSupports** | 1 |
| **Feeds** | he-wrote-the-note; identity; girl unlock |

#### `he-wrote-the-note`
| | |
|---|---|
| **Question** | Who wrote the threatening midnight note? |
| **Claim (sealed)** | **He** wrote it — it is his instrument, not a killer’s lure written *to* him. |
| **Requires** | `charred-note-found` |
| **Supports** | `{ evidenceId: notepad-indentations }` — desk pad matches note text |
| **minSupports** | 1 |
| **Feeds** | girl unlock; motive |

#### `girl-unlock-testimony` *(big unlock — locked room)*
| | |
|---|---|
| **Question** | What is the granddaughter hiding? |
| **Claim (sealed)** | He abused and threatened her; police ignored her; she did not kill him; grandmother found out, found the note, said she’d **handle it**. |
| **Requires** | `he-wrote-the-note` (and/or `charred-note-found`); constable not blocking door |
| **Supports** | `{ knowledge: granddaughter / full-crack }` — delivered only after she unlocks the door when player presents note and/or pad |
| **Unlock condition (engine)** | Door locked until present `charred-note` and/or `notepad-indentations` + constable not co-present; optional backup: staff key after note found |
| **minSupports** | 1 |
| **Feeds** | motive, identity |

Testimony contents (single knowledge dump or split beats):
- Ongoing abuse / threats  
- She went to the police; they did not believe her / failed her  
- She did **not** kill him  
- Grandmother **found out** (abuse + police failure)  
- There was a note (midnight gallery); grandmother said she’d **handle it**

#### `gun-in-her-room`
| | |
|---|---|
| **Question** | Who had the weapon that matches a shot from the hall? |
| **Claim (sealed)** | The murder weapon is hidden in the grandmother’s room. |
| **Requires** | — (findable anytime; fair play wants after trajectory known) |
| **Supports** | `{ evidenceId: gallery-gun }` |
| **minSupports** | 1 |
| **Feeds** | method, identity |

#### `shady-dealings` *(Plot B — optional)*
| | |
|---|---|
| **Question** | What else was he mixed up in? |
| **Claim (sealed)** | Highly illegal business; corrupt constable tied in; partner angry. |
| **Requires** | — |
| **Supports** | `{ evidenceId: shady-ledger }` and/or partner talk and/or girl fragments |
| **minSupports** | 1 |
| **Role** | Reinforces WHY police/system failed; **not** required for terminals |

---

### Terminals (rubric)

#### `method` → factId `method` · role method
| | |
|---|---|
| **Question** | How did he die? |
| **Claim (sealed)** | Shot from below in the great hall; fell from the gallery; bullet and/or fall killed him. She never threw him. |
| **Requires** | `shot-from-below` |
| **Supports** | `{ nodeId: shot-from-below }`, `{ evidenceId: gallery-gun }` |
| **minSupports** | 2 |

#### `motive` → factId `motive` · role motive
| | |
|---|---|
| **Question** | Why was he killed? |
| **Claim (sealed)** | To stop his abuse of the granddaughter when the police had already failed her; grandmother chose to handle the midnight threat herself. |
| **Requires** | `girl-unlock-testimony` (or at least maid + he-wrote-the-note if you soften — **prefer girl**) |
| **Supports** | `{ knowledge: granddaughter / full-crack }`, `{ nodeId: he-wrote-the-note }`, optional `{ nodeId: shady-dealings }` |
| **minSupports** | 2 (crack + note authorship; shady optional third) |

#### `identity` → factId `killer` · role identity
| | |
|---|---|
| **Question** | Who shot him? |
| **Claim (sealed)** | The grandmother (elderly woman in the wheelchair). |
| **Requires** | `shot-from-below`, `charred-note-found` |
| **Supports** | `{ evidenceId: gallery-gun }`, `{ knowledge: granddaughter / full-crack }` (found out + handle it), `{ evidenceId: charred-note }` |
| **minSupports** | 2 (gun + handle-it testimony **or** gun + note in her fireplace with trajectory already required) |

---

### Concrete supports checklist (all leaves)

| Id | Type | Location / source |
|---|---|---|
| `body-wound` | evidence | Great hall — body examine (gunshot + from below) |
| `charred-note` | evidence | Grandmother’s room — fireplace |
| `notepad-indentations` | evidence | Victim’s room — desk |
| `gallery-gun` | evidence | Grandmother’s room — hide |
| `shady-ledger` | evidence (Plot B) | Victim’s room |
| `maid / saw-wrist-grip` | knowledge | Maid talk |
| `granddaughter / full-crack` | knowledge | Her room after unlock |
| Partner / constable talk | social | Plot B + obstruction; not graph-critical |

---

### Happy-path resolve order

1. Examine body → `not-simple-fall` + `shot-from-below`  
2. Talk to maid → `maid-wrist-fear`  
3. Fireplace → `charred-note-found`  
4. His desk pad → `he-wrote-the-note`  
5. Present note/pad at her locked door → unlock → `girl-unlock-testimony`  
6. Find gun → `gun-in-her-room`  
7. Terminals method / motive / identity ready → **accuse grandmother**

Atmosphere (sound disagreements, wife’s love, son’s inheritance hunger, corrupt constable) — **outside** the critical graph.

---

## Cast

| Id | Role |
|---|---|
| **nephew** (name TBD) | Victim — abuser; note author; illegal dealings (Plot B); police friends |
| **grandmother** (name TBD) | Killer — wheelchair; fireplace note; gun in her room; shot from hall |
| **granddaughter** (name TBD) | Abuse survivor; note target; cracks in step 4; adamant she didn’t kill; knows Plot B fragments |
| **household witnesses** | Conflicting sounds (texture) |
| **police contact** (optional) | Why she doesn’t trust the law |

---

## Places (clue-critical)

| Id | Clues |
|---|---|
| **great-hall** | Body; examine wound/trajectory |
| **upper-gallery** | Context for midnight meeting |
| **grandmother-room** | Fireplace → charred note; hide → gun |
| **victim-room** | Desk notepad → indentations; Plot B papers |
| **granddaughter-room** | Talk path to crack; optional abuse traces |

---

## Moral ending note

She saved the girl and **chose murder** because police already failed the girl. Plot B (illegal business) deepens why he was untouchable — not a different killer.

---

## One-paragraph pitch (canonical)

> In an old mansion, a charming nephew trusted by the family and friendly with the police secretly abuses the orphaned granddaughter. He orders her by note to the upper gallery at midnight. Her grandmother finds the note, waits in the dark great hall, and shoots him from below; he falls. You prove the shot came from below, recover the half-burned note from the old lady’s fireplace, match it to indentations on his notepad, hear the girl break about the abuse and the police who would not help (and that she did not kill him), and find the gun in the old lady’s room. Optional papers show his illegal dealings — why power protected him. The grandmother never threw him. She only fired upward.

---

## Explicitly not this story

- Help-task / stair-lift accident plots.  
- She pushes him from the gallery by hand.  
- Note written by her **to him** as bait (only a first misread).  
- Plot B as the real solution or a second murderer.

---

## Next (when encoding)

- Names + player role  
- Exact hide for gun; fireplace inspectable; notepad discoverableAt  
- Knowledge beat gates for granddaughter crack (requires note and/or indentations)  
- `deductions[]` + `solution.rubric` from Plot A steps  
- Plot B evidence list (thin)
