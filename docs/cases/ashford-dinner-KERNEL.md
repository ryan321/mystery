# The Last Course at Ashford Hall — mystery kernel

**Status:** Kernel only (disturbance → solution → graph). Not a full definition yet.  
**Spirit:** Clue-the-movie ensemble manor farce under a real murder — not the same plot, weapons checklist, or ending.  
**Date:** 2026-07-23

Use with [CREATING_MYSTERIES.md](../CREATING_MYSTERIES.md). Expand to full content only after this holds.

---

## Working title

**The Last Course at Ashford Hall**

---

## Disturbance

Julian Ashford, industrialist and cruel host, dies during a private dinner for eight guests under his roof. Storm has sealed the road. Everyone still seated when he is found. No outsider entered after the first course.

## Stakes (if unsolved)

- A wrong person hangs (or a right person walks).
- Several guests’ secrets — blackmail, fraud, scandal — stay buried under a tidy “heart failure” story.
- The household staff are disposable suspects for the gentry if the truth is never forced into the open.

---

## Sealed solution

| Facet | Truth |
|---|---|
| **Identity** | **Victor Lang** — Ashford’s business partner and dinner guest |
| **Method** | Between the fish and the roast, Lang followed Ashford into the **study**, stabbed him once with Ashford’s own **letter opener**, wiped the blade on the desk blotter, poured a glass of port and left it spilled to suggest collapse/drink, returned to the dining room before the next course was plated |
| **Motive** | Ashford had forged share transfers to strip Lang’s company and planned to announce Lang’s “resignation” (ruin) as after-dinner entertainment; Lang found the forged papers in the study desk that evening and killed him rather than be destroyed at the table |
| **Summary** | Lang murdered Ashford in the study mid-dinner and staged a natural collapse. The wife and the doctor look guiltier at first glance; the partner had the means, the moment, and the reason. |

Rubric fact ids (for later encoding):

- `killer` — identity — matchHints: lang, victor, partner, business partner  
- `method` — method — matchHints: letter opener, study, stabbed, between courses, staged port  
- `motive` — motive — matchHints: forged shares, company, ruin, blackmail of lang, steal company  

---

## False appearance (opening lie)

**What it looks like at first**

1. Ashford “took ill” — wine, temper, heart. Dr. Holt is eager to call it natural causes (he has his own secret).
2. **Lady Evelyn** (the wife) is found near the study with **blood on her gloves** — she discovered the body and tried to check for a pulse; everyone assumes inheritance murder.
3. The dining room and the port glass sell a story of collapse at leisure, not a fight.

**Why that almost works**

- Evelyn inherits and hated him publicly.
- Holt is a doctor and says “heart.”
- No scream; no broken furniture; guests alibi each other at the table for most of the evening.

**Double-duty clue**

- The **port glass and blotter wipe**: early, “he was drinking alone in the study”; later, timing + smear pattern show the glass was set *after* the wound and the opener wiped on purpose.

---

## Solution graph

Paths branch; solution does not. Prefer ≥2 supports on terminals and critical leads.

### Lead: `death-not-natural`

- **Question:** Did Julian Ashford die of natural causes?
- **Claim (sealed):** No — he was stabbed.
- **Requires:** (none — open at start or after body examined)
- **Supports:**
  - evidence: `study-wound` (wound inconsistent with collapse; not shown in dining room)
  - evidence: `letter-opener-blood` (blade + blotter smear)
  - knowledge: `bridget` / `saw-blood-not-wine` (maid: what she cleaned wasn’t only port)
- **minSupports:** 1  
- **Feeds:** `killed-in-study`, `method`

### Lead: `killed-in-study`

- **Question:** Where was he actually killed?
- **Claim (sealed):** In the study, not at the dining table.
- **Requires:** `death-not-natural` (or open with body found in study — author choice: open when study visited)
- **Supports:**
  - evidence: `study-wound` + scene in study (body found there)
  - evidence: `dining-no-blood` (observation: no blood trail on dining chairs/carpet where he “sat”)
  - knowledge: `graves` / `found-him-in-study` (butler fetched him when he didn’t return for the roast)
- **minSupports:** 1  
- **Feeds:** `staging`, `method`

### Lead: `staging`

- **Question:** Was the scene arranged to look like a collapse?
- **Claim (sealed):** Yes — port poured/spilled after the attack; opener wiped.
- **Requires:** `killed-in-study`
- **Supports:**
  - evidence: `port-glass-staging` (fill level / no lip print / position vs wound)
  - evidence: `letter-opener-blood` (wipe on blotter, not a struggle mess)
  - knowledge: `dora-finch` / `port-already-open` (secretary: the good port was not poured for dinner service)
- **minSupports:** 1  
- **Feeds:** `method`, `window-of-absence`

### Lead: `window-of-absence`

- **Question:** Who left the table long enough to kill him between courses?
- **Claim (sealed):** Lang was gone during the fish→roast interval; others’ absences don’t fit as well (or are accounted for).
- **Requires:** `killed-in-study` (timing only matters once place is known)
- **Supports:**
  - knowledge: `graves` / `lang-missing-interval` (butler plating roast: Lang’s chair empty)
  - knowledge: `ivy-crane` / `lang-in-corridor` (goddaughter saw Lang toward the study wing)
  - knowledge: `pearl-voss` / `evelyn-in-powder-room` (Evelyn’s absence was the powder room — weakens “wife only” theory when combined with gloves explanation)
  - evidence: `place-card-timing` optional note of seating/service times
- **minSupports:** 2  
- **Feeds:** `identity`

### Lead: `evelyn-not-killer`

- **Question:** Is Lady Evelyn the murderer?
- **Claim (sealed):** No — she found him; blood on gloves is contact, not attack.
- **Requires:** `death-not-natural`
- **Supports:**
  - knowledge: `evelyn-ashford` / `found-body` (her account: entered study, tried for pulse)
  - evidence: `gloves-transfer-pattern` (smear consistent with hands on wound/chest, not grip on opener)
  - knowledge: `bridget` / `evelyn-scream-after` (cry *after* discovery, not before)
- **minSupports:** 1  
- **Feeds:** readiness (clears false suspect); supports fair identity

### Lead: `holt-covering`

- **Question:** Why is Dr. Holt so sure it was a heart attack?
- **Claim (sealed):** Ashford had leverage over Holt (botched treatment covered up); Holt wants the case closed as natural.
- **Requires:** (none or after talking to Holt)
- **Supports:**
  - knowledge: `marcus-holt` / `natural-causes-push` (over-certain diagnosis)
  - evidence: `holt-blackmail-note` (Ashford’s private note re: Holt’s mistake)
  - knowledge: `simon-pike` / `holt-afraid` (reverend noticed Holt’s fear of Ashford)
- **minSupports:** 1  
- **Feeds:** atmosphere + trust calibration; not required for terminals but good dual path for “don’t trust the doctor”

### Terminal: `method` → factId `method`

- **Question:** How was Julian Ashford murdered?
- **Claim (sealed):** Stabbed with the letter opener in the study; scene staged with port.
- **Requires:** `death-not-natural`, `killed-in-study`
- **Supports:**
  - node: `staging`
  - evidence: `letter-opener-blood`
  - evidence: `study-wound`
- **minSupports:** 2  

### Terminal: `motive` → factId `motive`

- **Question:** Why would someone kill him tonight?
- **Claim (sealed):** To stop Ashford from seizing Lang’s company via forged share transfers and public ruin at dinner.
- **Requires:** (none for open question; resolve when supports land)
- **Supports:**
  - evidence: `forged-share-drafts` (desk papers: transfers in Ashford’s hand / notary block incomplete)
  - evidence: `lang-ruin-memo` (Ashford’s dinner card: “Victor’s news” / resignation joke)
  - knowledge: `dora-finch` / `prepared-announcement` (secretary typed a “partnership change” note she wasn’t meant to read)
  - knowledge: `victor-lang` / `cornered` (under pressure he admits the business war — not the stab — if pressed with papers)
- **minSupports:** 2  

### Terminal: `identity` → factId `killer`

- **Question:** Who killed Julian Ashford?
- **Claim (sealed):** Victor Lang.
- **Requires:** `window-of-absence`, `evelyn-not-killer` (optional require: forces clearing the red-herring wife before identity “opens” as a casebook lead — good for Clue-spirit misdirection)
- **Supports:**
  - node: `window-of-absence` (as support once resolved)
  - evidence: `forged-share-drafts` + opportunity (combo via separate supports)
  - knowledge: `ivy-crane` / `lang-in-corridor`
  - knowledge: `bridget` / `lang-returned-composed` (Lang back to table calm; hands clean)
  - evidence: `lang-cuff-thread` optional micro-clue on blotter / opener
- **minSupports:** 2  

---

## Cast sketch (only as graph needs)

| Id | Role | Graph job |
|---|---|---|
| **julian-ashford** | Host (victim) | Body, blackmailer, forger |
| **evelyn-ashford** | Wife / guest | Primary false suspect; gloves; finds body |
| **victor-lang** | Business partner / guest | **Killer** |
| **marcus-holt** | Doctor / guest | False “natural causes”; blackmail side-path |
| **pearl-voss** | Socialite / guest | Alibi texture; notes Evelyn’s powder-room absence |
| **theo-raines** | Captain / guest | Loud red herring (argued with host); not killer |
| **ivy-crane** | Goddaughter / guest | Saw Lang toward study wing |
| **simon-pike** | Clergyman / guest | Notices Holt’s fear; moral pressure |
| **dora-finch** | Secretary / guest | Typed announcement; port detail; papers chain |
| **graves** | Butler | Found body in study; Lang’s empty chair at interval |
| **bridget** | Maid | Blood vs wine; Evelyn’s scream timing; Lang’s composure |

Eight guests: Evelyn, Holt, Pearl, Theo, Ivy, Lang, Pike, Dora.  
Plus host (dead), butler, maid.

---

## Place sketch (graph only)

| Id | Why it exists |
|---|---|
| **dining-room** | Dinner; false “he was with us”; empty-chair timing |
| **study** | Murder scene; opener, blotter, papers, port glass, body |
| **drawing-room** | Guests herded after discovery; talk |
| **powder-room** / corridor | Evelyn’s real absence |
| **kitchen** / pantry edge | Graves plating roast; Bridget |
| **entrance-hall** | Storm, arrival of inspector, no exit |

No need for a full manor map until encoding.

---

## Key items / leaves (to author later as evidence)

| Id | Supports |
|---|---|
| `study-wound` | death-not-natural, killed-in-study, method |
| `letter-opener-blood` | death-not-natural, staging, method |
| `port-glass-staging` | staging |
| `dining-no-blood` | killed-in-study |
| `gloves-transfer-pattern` | evelyn-not-killer |
| `forged-share-drafts` | motive, identity |
| `lang-ruin-memo` | motive |
| `holt-blackmail-note` | holt-covering |
| `lang-cuff-thread` (optional) | identity |

---

## Opening knowledge (player persona sketch)

**Inspector** (or county detective) called when the body is found; storm takes the line and the road. Told: host collapsed or worse during dinner; eight guests + staff still inside; Dr. Holt says heart; Lady Evelyn found with blood on her hands. Your job: who, how, why before morning invents a quieter story.

---

## Dual-path check (terminals)

| Terminal | Path A | Path B |
|---|---|---|
| **Method** | wound + opener | staging node (port + wipe) |
| **Motive** | forged share drafts | secretary announcement + ruin memo |
| **Identity** | absence window (butler + Ivy) | papers + Lang’s return / optional thread; Evelyn cleared so the case isn’t “the wife” |

---

## Not yet (on purpose)

- Full `definition.json`
- Full knowledge beat prose
- Beats, clocks, portraits, game-module voice
- Every alibi for every guest

Next encode step: `solution` + `deductions[]` + thin evidence/character stubs for supports only.
