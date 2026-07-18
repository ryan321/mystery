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

## Near-term plan

1. Landing page (this repo)
2. Minimal Mystery Definition schema
3. Founder-authored free short case + a few paid cases
4. Playable runtime (move / inspect / talk / inventory / solve / end)
5. Subscription (TBD)
6. Later: community-published definitions

## Principle

> Definition owns truth. Engine owns state. AI performs. Player is a character in the case.
