# Mystery — Architecture & Technical Design

**Status:** Design draft (living)  
**Date:** 2026-07-18  
**Sources of truth:** `WHAT.md`, `docs/PRODUCT.md`, landing page play model (`web/index.html`), **[CASE_DEFINITION.md](./CASE_DEFINITION.md)** (content model: entity state + dynamic beats)

> **Case content model:** Mysteries are not only a static map. Definitions describe **canon** (sealed), **world**, **entity state** (game / character / object / location), and a **plot graph** of story beats (conditions → effects). See [CASE_DEFINITION.md](./CASE_DEFINITION.md).

---

## 1. Goals and non-goals

### 1.1 What we are building

A **single-player browser game** where:

1. Each case is an **authored Mystery Definition** (structured data) with a **fixed solution**.
2. The player types **freeform natural language** (say *and* do).
3. A **TypeScript backend** loads definition + playthrough state, assembles a **gated context**, calls an **LLM via OpenRouter**, validates the model output, **updates state**, and returns the turn result.
4. A **Next.js/TypeScript frontend** presents location, narrative, dialogue, evidence, and input — matching the landing-page “case chrome” experience.

### 1.2 Hard product constraints (architecture must enforce)

| Constraint | Architectural implication |
|------------|---------------------------|
| Definition owns truth | Solution/secrets never fully enter the narrator prompt |
| Engine owns state | Location, evidence, flags, end conditions are authoritative in DB/code, not left to LLM prose |
| **World acts on player** | Threat, injury, control (held/restrained), eject, hazard falls, theft — engine phase `resolveWorldToPlayer`, not prose-only |
| AI performs | LLM classifies intents + `physical`; produces narrative; does not invent state |
| Freeform input | No parser verb grammar; NLU is model-assisted but outcomes are schema-validated |
| Single-player | No realtime multiplayer; one playthrough per session owner |
| No runtime case generation | Definitions are content artifacts, versioned and loaded |

### 1.3 Non-goals for v1

- Community authoring/publishing UI  
- Multiplayer / shared cases  
- Voice, heavy 3D/graphics  
- In-platform mystery generator  
- Perfect anti-jailbreak (good enough + iterative hardening)  
- Multi-region scale / complex billing (design hooks only)

---

## 2. Recommended system shape

### 2.1 Monorepo layout

```
mystery/
  apps/
    web/                 # Next.js App Router (player UI + marketing later)
    api/                 # Fastify or Hono TypeScript HTTP API
  packages/
    shared/              # Zod schemas, types, constants (definition + API contracts)
    engine/              # Pure game logic: state machine, gating, validation (no HTTP)
    llm/                 # OpenRouter client, prompt builders, response parsers
  content/
    cases/
      blackwood-inheritance/
        definition.json  # or definition.yaml + compiled JSON
        assets/          # optional portraits, cover
  docs/
    ARCHITECTURE.md      # this design, living in repo after approval
  web/                   # existing static landing (keep; migrate later)
```

**Why monorepo**

- Shared Zod types prevent frontend/backend drift  
- `engine` is unit-testable without network  
- Content cases live next to code with PR review  

**Why split `api` from Next (not only Route Handlers)**

- Long LLM turns, retries, and background work fit a dedicated API process  
- Clearer secrets boundary (OpenRouter key never in browser)  
- Easier to scale API workers independently later  
- Next can still BFF-proxy for cookies if desired  

**Acceptable MVP shortcut:** Next Route Handlers calling `packages/engine` if shipping speed matters — keep the *package* split so extraction is trivial.

### 2.2 High-level runtime diagram

```
┌─────────────┐     HTTPS      ┌─────────────┐
│  Next.js    │ ─────────────► │  API        │
│  (player)   │ ◄───────────── │  (Hono/     │
└─────────────┘   JSON turn    │   Fastify)  │
                               └──────┬──────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              ┌──────────┐     ┌──────────┐     ┌────────────┐
              │ Postgres │     │ Engine   │     │ OpenRouter │
              │ state    │     │ packages │     │ LLM        │
              └──────────┘     └──────────┘     └────────────┘
                                      ▲
                                      │ load
                               ┌──────────────┐
                               │ Case content │
                               │ definitions  │
                               └──────────────┘
```

---

## 3. Core domain models

### 3.1 Mystery Definition (content, immutable per version)

Authoring unit. Versioned (`schemaVersion`, `caseId`, `contentVersion`).

**Top-level (conceptual):**

```ts
MysteryDefinition {
  schemaVersion: "1"
  id: string                    // "blackwood-inheritance"
  contentVersion: string        // "1.0.0" or git sha
  meta: { title, premise, tone, estimatedMinutes, tags, difficulty, contentWarnings }
  player: {
    displayName, role, voiceNotes
    startingLocationId
    startingEvidenceIds: string[]
    startingKnowledge: string   // briefing the player already knows
  }
  locations: Location[]
  characters: Character[]
  evidence: EvidenceItem[]      // discoverable / takeable objects & abstract clues
  flags: FlagDef[]              // named booleans/enums the engine tracks
  solution: Solution            // NEVER sent to narrator prompts wholesale
  endings: Ending[]
  // optional v1.1+
  phases?: PhaseDef[]
  events?: RuntimeEventDef[]
}
```

**Location**

```ts
Location {
  id, name, description           // base description
  exits: { toLocationId, label?, requiresFlags? }[]
  inspectables: {
    id, name
    hidden?: boolean              // only appears after discover
    onInspect: {
      narrativeHints?: string     // author notes for AI
      revealsEvidenceIds?: string[]
      setsFlags?: Record<string, boolean | string>
      requiresFlags?: ...
    }
  }[]
  charactersPresent: {            // default occupancy; can be state-overridden
    characterId
    // optional conditions
  }[]
}
```

**Character (knowledge-layered)**

```ts
Character {
  id, name, shortBio, voice
  // where they can appear (default + conditional)
  knowledge: {
    public: string                // always free to discuss
    private: KnowledgeBeat[]      // gated
    secrets: KnowledgeBeat[]      // tightly gated
  }
  // what they will actively lie about / protect
  defenses: string[]
}

KnowledgeBeat {
  id
  content: string                 // factual content they may reveal
  // release conditions (engine evaluates; AI only sees if released OR as "forbidden")
  requiresFlags?: ...
  requiresEvidenceIds?: ...       // player must possess / have presented
  requiresTrust?: number
  // if not released: AI must not reveal content
}
```

**Evidence**

```ts
EvidenceItem {
  id, name, description
  // how it enters play
  discoverableAt?: { locationId, inspectableId }
  // presentation
  canPresentTo?: characterId[] | "*"
}
```

**Solution & endings (author-only at runtime)**

```ts
Solution {
  summary: string                 // truth narrative for ending generation
  guiltyPartyIds: string[]
  method?: string
  motive?: string
  // structured rubric for scoring accusations
  rubric: {
    requiredFacts: { id, description, matchHints: string[] }[]
    partialCredit?: boolean
  }
}

Ending {
  id
  when: "success" | "partial" | "failure" | "custom"
  requiresFlags?: ...
  templateNotes: string           // for AI epilogue grounding
}
```

**Design rule:** The definition is large; **prompts never include the full document**. The engine projects a **ContextPack** per turn.

### 3.2 Playthrough State (mutable, per player run)

Authoritative game state in Postgres:

```ts
Playthrough {
  id
  userId?                         // null for anonymous free trial with signed cookie
  caseId
  contentVersion                  // pin definition version at start
  status: "active" | "solved" | "failed" | "abandoned"
  locationId
  evidenceIds: string[]
  flags: Record<string, boolean | string | number>
  notebook: NotebookEntry[]       // auto + optional player notes
  // per-character dialogue memory (summaries + recent turns)
  characterMemory: Record<characterId, {
    revealedBeatIds: string[]
    summary: string               // rolling summary for long chats
    recentTurns: { role, text, at }[]  // last N raw
  }>
  turnCount
  createdAt, updatedAt
}
```

**Turn log** (append-only audit + debugging + future training):

```ts
Turn {
  id, playthroughId, index
  playerInput: string
  // optional classified intent
  intent?: Intent
  // model request/response metadata (model, tokens, latency)
  // state before/after snapshots or patches
  statePatch: JSON
  assistantMessages: { kind: "narration" | "dialogue" | "system", ... }[]
  createdAt
}
```

### 3.3 Intent model (internal, not exposed as commands)

Free text is classified into one or more intents for routing and validation:

| Intent | Examples from landing sample |
|--------|------------------------------|
| `inspect` | “Examine the broken vase and the floor around it.” |
| `move` | “Follow the footprint to the library.” / “Return to the entrance hall…” |
| `take` | “Take the brass key…” |
| `talk` | “Henshaw. What did you see tonight?” |
| `present_evidence` | (implied when showing receipt) |
| `use` | “try it on the desk drawer” |
| `accuse` / `solve` | “I know who did it…” |
| `meta` | inventory, notebook, help, map |
| `other` | ambient / unclear — narrator with safe defaults |

**Intent classification options (choose in implementation phase 1):**

1. **Single LLM call** returns structured `{ intents, narration, statePatch }` (simpler, fewer round-trips)  
2. **Two-step:** cheap/fast model classifies → main model narrates with a specialized context (better control, more latency/cost)  

**Recommendation for v1:** **Single structured call** with a strong JSON schema + **engine validation**. Add a second-step classifier only if leak/quality problems force it.

---

## 4. The turn pipeline (heart of the system)

Every player message hits one primary endpoint:

`POST /v1/playthroughs/:id/turns`  
Body: `{ input: string }`

### 4.1 Pipeline stages

```
1. AuthZ          Load session; verify playthrough ownership
2. Load           Playthrough + pinned MysteryDefinition
3. Guard          If status != active → reject or only allow read
4. Assemble       Build ContextPack (gated knowledge)
5. Prompt         Build messages for OpenRouter
6. Complete       LLM structured output (JSON schema / tool call)
7. Validate       Engine checks patches against rules
8. Referee (opt)  Second pass if leak heuristics fire
9. Commit         Transaction: apply patch, append turn, update memory
10. Respond       DTO for UI (narration, dialogue, status, evidence deltas)
```

### 4.2 ContextPack (what the model is allowed to see)

Built **only** from definition + state:

```ts
ContextPack {
  caseMeta: { title, tone }           // no solution
  player: { persona, whatYouKnow }
  location: {
    id, name, description
    visibleInspectables               // filtered by discovery flags
    exits: { label, toName }[]        // may hide locked exits or mark locked
    presentCharacters: { id, name, short }[]
  }
  evidenceHeld: { id, name, description }[]
  flagsPublic: ...                    // only flags marked AI-visible
  activeCharacter?: {
    id, name, voice
    // ONLY knowledge beats currently releasable OR already revealed
    allowedKnowledge: string[]
    // explicit deny list for this turn (summaries of unreleased secrets)
    mustNotReveal: string[]           // short red-team constraints, not full secrets if avoidable
    recentDialogue: ...
    memorySummary: ...
  }
  recentSceneLog: ...                 // last K narrations (not whole case)
  instructions: static system policy
}
```

**Critical:** `solution`, unreleased `KnowledgeBeat.content`, and other characters’ secret graphs must not appear in the pack.

For **accuse/solve** turns, use a **different pack**:

- Include `solution.rubric` + `solution.summary` only in an **evaluator** prompt  
- Or evaluate with engine-first structured form + optional AI scoring of free text against rubric  

### 4.3 Structured LLM output (contract)

Prefer OpenRouter models with **JSON schema / structured outputs**.

```ts
TurnModelOutput {
  // UI-facing
  narration: string                   // second person scene text
  dialogue?: { characterId, characterName, text }[]
  // optional UI hints
  locationId?: string                 // if moved
  // engine proposals (never trusted blindly)
  patch: {
    setLocationId?: string
    addEvidenceIds?: string[]
    setFlags?: Record<string, boolean | string | number>
    revealBeats?: { characterId, beatId }[]
    notebookAppend?: string[]
    // accuse
    accuse?: {
      summary: string
      suspectIds?: string[]
      method?: string
      motive?: string
    }
  }
  // debug-ish (server may strip)
  intentGuess?: string
}
```

### 4.4 Engine validation (non-negotiable)

Before commit, engine applies pure functions:

| Check | Behavior |
|-------|----------|
| `setLocationId` must be legal exit (or same room) given flags | Reject illegal move; optionally rewrite narration via repair call or fixed message |
| `addEvidenceIds` only if discoverable here / conditions met | Drop illegal adds |
| `revealBeats` only if conditions met | Drop illegal reveals |
| Flags only known flag keys | Drop unknown |
| Accuse only if `status===active` | Evaluate rubric; set status; select ending |
| Output length / empty narration | Retry once |

**Philosophy:** The model *proposes*; the engine *decides*.

### 4.5 Optional referee pass

If heuristics detect spoilers (e.g. output contains solution keywords, or player jailbreak patterns):

1. Run a small “censor/revise” completion with `mustNotReveal` and original narration  
2. Or replace with safe fallback: “They deflect. You don’t get a clear answer.”  

Start **without** a permanent second call; add when metrics show leaks.

### 4.6 Memory maintenance

After each talk-heavy turn:

- Append to `characterMemory[id].recentTurns` (cap N, e.g. 12)  
- Periodically (every K turns or when token budget tight): summarize older turns into `summary` with a cheap model  

---

## 5. API surface (v1)

### 5.1 Cases (catalog)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/cases` | List published cases (meta only) |
| GET | `/v1/cases/:caseId` | Case detail for lobby (no solution) |

### 5.2 Playthroughs

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/playthroughs` | Start case `{ caseId }` → initial state + opening narration |
| GET | `/v1/playthroughs/:id` | Resume: state + recent log |
| POST | `/v1/playthroughs/:id/turns` | Submit free text input |
| POST | `/v1/playthroughs/:id/accuse` | Optional **structured** accuse UI (parallel to free text) |
| GET | `/v1/playthroughs/:id/evidence` | Evidence list |
| GET | `/v1/playthroughs/:id/notebook` | Notebook |
| GET | `/v1/playthroughs/:id/map` | Locations known + current (fog of war optional) |

### 5.3 Auth (minimal)

**v1 recommendation:**

- Anonymous play for free case via **httpOnly signed session cookie** (`play_session`)  
- Optional account later (email magic link / OAuth) for library + cross-device  

Do not block vertical slice on full auth product.

### 5.4 Streaming

**Phase 1:** non-streaming JSON turn (simpler correctness).  
**Phase 2:** SSE/WebStream for narration tokens after validation is harder — either stream raw then reconcile (risky) or stream only after structured parse (less “live”).  

Prioritize correctness over streaming for fair-play.

---

## 6. Frontend architecture (Next.js)

### 6.1 Routes (App Router)

```
/                     # marketing (migrate static landing later)
/play                 # case select / library
/play/[playthroughId] # active case UI
```

### 6.2 Active case UI (from landing chrome)

Layout columns/regions:

1. **Chrome:** case title, Evidence / Notebook / Map drawers  
2. **Status:** current location  
3. **Log:** scrollback of narration + dialogue bubbles (player avatar / NPC initials)  
4. **Composer:** single free-text input + send  
5. **Toasts/banners:** “Evidence added: …”  
6. **End screen:** when status solved/failed  

State management:

- Server components for lobby; client component for play loop  
- React Query or SWR for playthrough fetch  
- Optimistic UI optional; prefer waiting on turn for truthfulness  

### 6.3 Accessibility & motion

- Respect `prefers-reduced-motion` (landing already does)  
- Keyboard send (Enter), clear focus states  

---

## 7. Backend architecture

### 7.1 Process

- **Hono** or **Fastify** on Node 22  
- `packages/engine` pure TS  
- `packages/llm` OpenRouter via `openai`-compatible SDK (`baseURL: https://openrouter.ai/api/v1`)  

### 7.2 Data store

**Postgres** (Neon/Supabase/RDS — pick at deploy time):

Tables (sketch):

- `users` (nullable for later)  
- `playthroughs` (jsonb for flags/evidence/memory OK initially; normalize later if needed)  
- `turns` (append-only)  
- `cases` (optional registry; or filesystem content index)  

**v1 content loading:** read `content/cases/*/definition.json` at boot; validate with Zod; pin `contentVersion` on playthrough start.

### 7.3 Idempotency & concurrency

- `POST turns` with optional `Idempotency-Key` header  
- Row lock / `UPDATE ... WHERE turn_count = $expected` to prevent double-submit races  

### 7.4 Observability

Log per turn: playthroughId, caseId, model, latency, tokens, validation rejects, leak heuristic hits.  
Never log full secrets in client-facing errors.

### 7.5 Cost controls

- Max input length  
- Max turns per playthrough / per day (free tier)  
- Model tiering: primary narrator vs cheap summarizer  
- Hard timeout + friendly error  

---

## 8. LLM strategy (OpenRouter)

### 8.1 Roles

| Role | Model class | Job |
|------|-------------|-----|
| Narrator | Strong (e.g. Claude Sonnet / GPT-class) | Structured turn output |
| Summarizer | Cheap/fast | Memory compression |
| Evaluator (accuse) | Strong | Score free-text accusation vs rubric (optional) |
| Referee | Medium | Rewrite leaky output (optional) |

Exact model IDs configurable via env (`LLM_NARRATOR_MODEL`, etc.).

### 8.2 Prompt layers

1. **Static system policy** — second person; don’t invent map edges; don’t reveal unreleased secrets; don’t change who is guilty; output JSON only  
2. **Case tone** — from meta  
3. **ContextPack JSON** — current projection  
4. **Player input** — raw text  

### 8.3 Failure modes

| Failure | Handling |
|---------|----------|
| Invalid JSON | One repair retry with error message |
| Illegal patch | Strip + optional short engine narration |
| Empty / refuse | Fallback line + no state change |
| Provider 429/5xx | Retry with backoff; surface “try again” |

---

## 9. Security & anti-cheat (fair play)

1. **Never ship solution to browser**  
2. **Never put full solution in narrator context**  
3. **Server-side only** OpenRouter key  
4. Rate limit turns by IP/session  
5. Basic prompt-injection patterns: if input matches jailbreak regex, set `mode: adversarial` tightening `mustNotReveal`  
6. Accuse evaluation server-side only  
7. Content version pinning avoids mid-run definition edits  

---

## 10. Testing strategy (design early)

| Layer | What |
|-------|------|
| Unit | Engine: exits, evidence gates, beat release, accuse rubric |
| Contract | Zod definition fixtures for Blackwood sample |
| Golden turns | Fixed inputs → expected patches (mock LLM) |
| Leak tests | Adversarial inputs; assert secrets not in output (integration with real model in CI optional/nightly) |
| E2E | Playwright: start case, send turn, see evidence banner |

**Do not** rely only on manual playtests for knowledge gating.

---

## 11. Phased delivery (build order)

### Phase 0 — Design freeze artifacts
- Write `docs/ARCHITECTURE.md` (this) into repo  
- Write `packages/shared` Zod for `MysteryDefinition` v1  
- Author **minimal Blackwood Inheritance definition** (enough for sample path)

### Phase 1 — Vertical slice (must play)
- `engine` + in-memory or Postgres playthrough  
- `api` start + turn  
- OpenRouter narrator with structured output + validation  
- Next `/play/[id]` minimal log + composer  
- One path: hall → inspect vase → talk Henshaw → library → key/letter → talk Vale  

### Phase 2 — Productize free case
- Full Blackwood definition + endings + accuse flow  
- Evidence / notebook / map drawers  
- Anonymous sessions + turn limits  
- Landing CTA → real play  

### Phase 3 — Platform
- Case catalog UI  
- Subscription hooks  
- Multiple cases  
- Memory summarizer + metrics dashboard  

### Phase 4 — Later
- Author tooling  
- Community publish  
- Streaming polish  
- Referee model  

---

## 12. Key design decisions (recommendations)

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Monorepo | Yes (`apps/*`, `packages/*`) | Shared types, one PR |
| API framework | Hono or Fastify | Light, TS-native |
| DB | Postgres + JSONB for flexible state | Enough structure, fast iteration |
| Content | Files in `content/cases` v1 | PR reviewable, simple |
| LLM access | OpenRouter only from API | Key safety, model flexibility |
| Turn structure | Single structured completion + engine validate | Latency/cost vs control balance |
| Accuse UX | Free text *and* optional structured form | Landing shows free text; structured more reliable scoring |
| Streaming | Defer | Correctness first |
| Auth | Cookie session anonymous first | Unblock free case |

---

## 13. Open questions (resolve before or during Phase 0)

1. **Hosting target?** (Fly.io / Railway / Vercel web + Fly API / single VPS)  
2. **Accuse:** free-text only vs form fields (who / how / why) as primary?  
3. **Map fog-of-war:** only visited locations vs full manor map?  
4. **Definition format authoring:** hand-JSON vs YAML vs small TS objects compiled to JSON?  
5. **Narrator model preference** on OpenRouter for quality vs cost?  

Defaults if unspecified: Fly/Railway API + Vercel web; **structured accuse secondary**; fog-of-war visited-only; **YAML→JSON or plain JSON**; configurable model env.

---

## 14. Risks (technical)

| Risk | Mitigation |
|------|------------|
| Model invents rooms/items | Closed world list in ContextPack; validate exits/evidence |
| Model leaks killer | Knowledge gating + mustNotReveal + leak tests + referee later |
| Context window blowup | Rolling summaries; cap recent log |
| Cost per free user | Turn caps; smaller model for free tier |
| Ambiguous free text | Structured output + conservative engine defaults |
| Schema overbuild | Blackwood-driven minimal fields only |

---

## 15. Success criteria for the architecture

The design is successful when:

1. A second case can ship by **adding content only** (no engine rewrite).  
2. Unit tests can prove illegal moves/evidence cannot apply.  
3. Narrator prompts are reconstructible from ContextPack logs without containing the solution.  
4. One engineer can follow this doc and implement Phase 1 without reinventing product rules.  

---

## 16. Immediate next step after approval

1. Check this design into `docs/ARCHITECTURE.md`  
2. Implement `packages/shared` Zod schemas  
3. Draft Blackwood definition covering the landing sample path  
4. Scaffold monorepo (`pnpm` workspaces) with empty `engine` tests green  
5. Only then wire OpenRouter + Next play UI  

**Do not** start with UI polish or multi-case catalog before the turn pipeline and definition schema exist.
