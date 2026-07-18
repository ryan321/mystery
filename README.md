# Mystery

Single-player, fair-play **text investigation** games. Structured mystery definitions with fixed solutions; AI runs the cast and the world — not the truth.

## Docs

| Doc | Purpose |
|-----|---------|
| [WHAT.md](./WHAT.md) | Product definition — what the game *is* |
| [docs/PRODUCT.md](./docs/PRODUCT.md) | Full brief: market, monetization, roadmap, landing goals |

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
packages/shared   Zod schemas + types
packages/engine   Pure game logic (gates, patches, context pack)
packages/llm      OpenRouter client (stub → narrator)
content/cases     Authored mystery definitions
web/              Static marketing landing page
```

### Dev

```bash
pnpm install
pnpm --filter @mystery/shared build
pnpm --filter @mystery/engine test
pnpm dev:api    # http://localhost:8787
pnpm dev:web    # http://localhost:3000
```

Set `OPENROUTER_API_KEY` when the live narrator is wired (mock narrator works offline).

## Principle

> Definition owns truth. Engine owns state. AI performs. Player is a character in the case.
