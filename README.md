# Mystery

Single-player, fair-play **text investigation** games. Structured mystery definitions with fixed solutions; AI runs the cast and the world — not the truth.

## Docs

| Doc | Purpose |
|-----|---------|
| [WHAT.md](./WHAT.md) | Product definition — what the game *is* |
| [docs/PRODUCT.md](./docs/PRODUCT.md) | Full brief: market, monetization, roadmap, landing goals |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design: API, engine, LLM, turn pipeline |
| [docs/CASE_AUTHORING.md](./docs/CASE_AUTHORING.md) | **Write a case:** full `definition.json` reference |
| [content/cases/definition.schema.json](./content/cases/definition.schema.json) | JSON Schema for editor autocomplete (`pnpm schema`) |
| [docs/CASE_DEFINITION.md](./docs/CASE_DEFINITION.md) | Design model: entity state, beats, philosophy |
| [docs/TURN_PIPELINE.md](./docs/TURN_PIPELINE.md) | Two-call turn: director → engine → performer |
| [docs/PLAYER_SURFACES.md](./docs/PLAYER_SURFACES.md) | Ambient knowledge: opening package, fog-of-war map, cast dossier, UI stance |
| [docs/MYSTERY_BUNDLES.md](./docs/MYSTERY_BUNDLES.md) | Bundle format (zip), DB registry, upload pipeline, access/unlock model |
| [docs/SUBSCRIPTIONS.md](./docs/SUBSCRIPTIONS.md) | Accounts (magic link), Stripe tiers, seasonal free windows, elite invitations |
| [docs/MYSTERY_STUDIO.md](./docs/MYSTERY_STUDIO.md) | Mystery Studio: local-only authoring & review webapp |

## Landing page

Static site in [`web/`](./web/):

```bash
cd web
python3 -m http.server 5173
# open http://localhost:5173
```

- Explains the product for **players**
- Primary CTA: free short case / waitlist email
- Subscription mentioned; **pricing TBD**
- Waitlist emails stored in `localStorage` for now (wire a real backend later)

## Architecture

See **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** for the full technical design:
monorepo layout, Mystery Definition schema, turn pipeline (context pack →
OpenRouter → engine validation), API surface, and phased delivery.

## Monorepo

```
apps/web          Next.js player UI
apps/api          Hono API (turns, playthroughs)
apps/studio       Mystery Studio — local-only authoring/review (never deployed)
packages/shared   Zod schemas + types
packages/engine   Pure game logic (gates, patches, context pack)
packages/llm      OpenRouter client (stub → narrator)
content/cases     Authored mystery definitions
web/              Static marketing landing page
```

### Dev

```bash
# once: create local DB
psql -d postgres -c "CREATE DATABASE mystery;"

pnpm install
cp .env.example .env   # optional: set OPENROUTER_API_KEY, DATABASE_URL

pnpm test
pnpm dev:api           # http://localhost:8787  (builds packages, migrates, serves)
pnpm dev:web           # http://localhost:3000 → /play
pnpm dev:studio        # http://localhost:3100 → Mystery Studio (authoring, local only)
```

- **Postgres:** default `postgres://localhost:5432/mystery` (override with `DATABASE_URL`)
- **Narrator:** OpenRouter when `OPENROUTER_API_KEY` is set; otherwise closed-world **heuristic** (still engine-validated)
- Migrations run on API boot (`apps/api/sql/001_init.sql`)

## Principle

> Definition owns truth. Engine owns state. AI performs. Player is a character in the case.
