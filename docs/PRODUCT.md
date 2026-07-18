# Mystery — Product Brief

**Status:** Active  
**Updated:** 2026-07-17  
**Repo:** `mystery`  
**Related:** [WHAT.md](../WHAT.md) (product definition)

---

## 1. Elevator pitch

**Mystery** is a single-player, text-based investigation game. Each case is a structured **Mystery Definition** with a fixed solution. You play as a character inside the case (detective, Nancy Drew–style sleuth, journalist, etc.). You move through a text world, inspect, collect evidence, and talk to people who know more than they say — and remember what they told you. The AI **runs** the investigation. It does **not** invent or rewrite the truth.

When you solve the case, the game **ends** with an ending that fits the authored solution and the state of your playthrough.

---

## 2. Why this exists

1. **No one has shipped a clearly good AI mystery platform yet** — prototypes and thin apps exist; fair-play + AI investigation + trusted cases is still open.
2. **People already pay for mysteries** — books, TV, podcasts, case kits (e.g. Hunt a Killer), escape rooms, games.
3. **Community publishing comes later** — first the platform must prove great official cases; then others can share definitions.

**Not competing as:** open-ended AI fantasy RP (AI Dungeon–style usage).  
**Competing as:** detective games / case kits, with freeform interrogation powered by AI.

---

## 3. Product decisions (locked)

| Decision | Choice |
|----------|--------|
| Multiplayer | **No** — single-player core |
| Mystery structure | **Required** — formal Mystery Definition |
| In-platform case generation | **No** — platform runs definitions; AI tools may be used *offline* to help author them |
| AI role | **Runtime** — portray NPCs, describe world, respect secrets & state |
| Player role | **In-case persona** — often detective, not limited to it |
| World (v1) | **Text** — move between locations |
| Inspection | **Yes** — look / inspect for detail and clues |
| Inventory | **Yes** — track obtained items / evidence |
| NPC knowledge | **Asymmetric** — usually know more than they say |
| NPC memory | **Yes** — remember what they said to the player this run |
| Solution | **Fixed**, owned by definition |
| Game state | **Tracked** — flags, progress, unlocked knowledge |
| Ending | **Hard end** when solved (plus optional fail/partial if defined) |
| Launch content | **Founder-authored compelling mysteries first** — no UGC dependency |
| Monetization | **Free short case** → **subscription** (pricing TBD) |

---

## 4. What a Mystery Definition contains

See [WHAT.md](../WHAT.md) for full detail. Minimum:

1. **Meta** — title, premise, tone, length  
2. **Player persona** — who you are, starting knowledge, start location, starting inventory  
3. **World** — locations, exits, inspectables  
4. **Characters** — public/private/secret knowledge, conditions, memory  
5. **Objects & inventory rules**  
6. **Solution** — truth + what counts as solved  
7. **State model** — flags / phases that advance the case  
8. **Endings** — coherent resolution material  

---

## 5. Player verbs (v1)

- **Move** between locations  
- **Look / inspect** places and things  
- **Talk** freeform to characters  
- **Take / use / present** evidence as rules allow  
- **Inventory**  
- **Notebook** (recommended)  
- **Solve / accuse** → evaluate → **end**  

Engine owns: map legality, inventory, state, win check, dialogue memory store.  
AI owns: voice, description, in-bounds performance.

**Principle:**  
> Definition owns truth. Engine owns state. AI performs. Player is a character in the case.

---

## 6. Assessment (why this is a good bet)

### Strengths
- Clear architecture (fixes the usual AI-mystery failure modes)  
- Distinct from AI RP sandboxes  
- Complete verb set for a text detective game  
- Hard ending supports “finish a case → want another” retention  
- Founder-authored launch catalog builds trust before community  

### Risks to manage
- Definition format scope creep — ship minimal schema, learn from case #1  
- Freeform talk vs anti-spoiler discipline  
- Solve UX (structured accusation preferred over pure free text)  
- Content cost — need several strong official cases  
- Inventory should favor **evidence**, not adventure-game key jank  

### If it fails
Likely on **execution** (leaky NPCs, weak first case, awkward solve) — not on a confused product idea.

---

## 7. Go-to-market & monetization

### Funnel
1. **Landing page** — explain the product; convert curiosity → intent  
2. **Free short case** — full vertical slice of the real game (not a fake trailer)  
3. **Subscription (TBD)** — more cases, ongoing library, investigation capacity  

### Pricing posture
- Free case must be **good enough to prove fairness and fun**  
- Paid tier sells **more mysteries worth finishing**, not unlimited AI chat  
- Exact price TBD (directional comps: ~$10–20/mo mystery/AI entertainment band)  
- Meter AI cost via plan limits / energy if needed  

### Content strategy
| Phase | Content |
|-------|---------|
| Launch | 1 free short case + 2–4 paid official cases (founder-created) |
| Growth | Monthly / regular official drops |
| Later | Community publish of Mystery Definitions (quality gates) |

**Community publishing is a destination, not a launch dependency.**  
You must create compelling mysteries before anyone else shares on the platform.

---

## 8. Landing page goals

**Job of the page:** visitor instantly understands **murder mystery game** and wants to play.  
Do **not** explain every mystery type the engine could support.

### Must communicate (player language)
1. There’s been a **murder** — you find the **killer**  
2. Question **suspects**, hunt **clues**, make an **accusation**  
3. Specific free case hook (body + suspects)  
4. Free case → more murder cases on subscription (price TBD)  

### Do not lead with
Genre flexibility, platform vision, AI architecture, community publishing.

### Tone
Whodunit appetite — body, lies, “I know who did it.” Not product deck.

---

## 9. Roadmap (near term)

| Step | Outcome |
|------|---------|
| ✅ Product definition | WHAT.md + this brief |
| → Landing page | Conversion site live in repo |
| → Mystery Definition schema | Minimal format for one case |
| → Flagship free short case | Authored definition |
| → Playable runtime v1 | Move / talk / inspect / inventory / solve / end |
| → Paid cases + sub | TBD pricing, checkout |
| Later | Author tools + community publish |

---

## 10. Success metrics

**Landing**
- Email signup rate (waitlist) or free-case start rate  
- Scroll depth / “how it works” engagement  

**Product**
- Free case completion rate  
- “Solution felt fair” rating after reveal  
- Free → paid conversion  
- Case 2 start rate among completers  

**Quality bar**
- AI does not spoil or rewrite the solution in normal play  
- NPCs stay consistent with memory  
- Ending matches authored truth  

---

## 11. Working name

**Mystery** (placeholder brand). Rename later if needed; product shape is stable.

---

## 12. One-liner for marketing

> Fair-play mystery cases you investigate in freeform text — suspects who lie, evidence you collect, a real solution, and an ending that earns it. First case free.
