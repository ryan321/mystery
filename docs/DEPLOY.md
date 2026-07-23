# Deploying MysteryTrove to Fly.io

Two Fly apps built from the repo root: **mysterytrove-api**
(`Dockerfile.api` + `fly.api.toml`) and **mysterytrove-web**
(`Dockerfile.web` + `fly.web.toml`). Postgres lives on Neon
(us-east-1, so both apps pin `primary_region = "iad"`). The studio is
local-only and never deployed; `.dockerignore` excludes it.

## One-time setup

```bash
fly auth login

# Create the apps (no deploy yet)
fly apps create mysterytrove-api
fly apps create mysterytrove-web

# API secrets (values from your local .env / dashboards)
fly secrets set -a mysterytrove-api \
  DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require' \
  OPENROUTER_API_KEY='sk-or-...' \
  RESEND_API_KEY='re_...' \
  LLM_NARRATOR_MODEL='deepseek/deepseek-v4-pro' \
  LLM_DIRECTOR_MODEL='deepseek/deepseek-v4-pro'
```

Optional API secrets, when they become relevant:

| Secret | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in. OAuth client (Web application) from [Google Cloud Console](https://console.cloud.google.com/apis/credentials); authorize `https://mysterytrove-api.fly.dev/v1/auth/google/callback` (and later `https://api.mysterytrove.com/...`) as redirect URIs. Routes 501 until set. |
| `API_ORIGIN`, `WEB_ORIGIN` | Public origins for the OAuth dance and magic-link URLs — in production set `API_ORIGIN=https://mysterytrove-api.fly.dev` and `WEB_ORIGIN=https://mysterytrove-web.fly.dev` (swap for the custom domains once live). |
| `MAIL_FROM` | Verified Resend sender, e.g. `MysteryTrove <signin@mysterytrove.com>`. Until the domain is verified in Resend, mail comes from `onboarding@resend.dev`, which only delivers to the Resend account owner. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | Subscriptions (docs/SUBSCRIPTIONS.md). Billing endpoints return 501 until set. |

The web app needs no secrets: `NEXT_PUBLIC_API_URL` is a **build arg**
baked into the client bundle, set in `fly.web.toml` under
`[build.args]`.

## Deploy

**From GitHub (the normal path).** Pushing to `main` deploys
automatically via GitHub Actions
(`.github/workflows/deploy-api.yml` / `deploy-web.yml`), so every
release is built from committed repo state. Each workflow only fires
when its app's files change (shared packages trigger both), and both
can be run manually from the Actions tab. One-time wiring:

```bash
# Mint a deploy token and add it to the GitHub repo as FLY_API_TOKEN
fly tokens create deploy -x 999999h
gh secret set FLY_API_TOKEN
```

**From your machine (escape hatch).** Ships your local working tree,
uncommitted changes included:

```bash
pnpm deploy:api    # fly deploy -c fly.api.toml
pnpm deploy:web    # fly deploy -c fly.web.toml
```

On boot the API runs migrations and auto-imports `content/cases/*`
(baked into the image) as published bundles — same as local dev.

## Shipping content updates

**The boot import only seeds cases that are missing entirely — it does
NOT upgrade an existing case to a newer `contentVersion`.** (Learned the
hard way 2026-07-23: a rescaled Blackwood time schedule sat in the image
across two deploys while prod kept serving the old version.) To ship a
content change to prod:

1. Bump `contentVersion` in the case's `definition.json` — uploads with a
   duplicate `(caseId, contentVersion)` are rejected.
2. Publish against the live API:

   ```bash
   ADMIN_TOKEN=$(fly ssh console -a mysterytrove-api -C "printenv ADMIN_TOKEN" | tr -d '\r\n') \
     pnpm publish-case <caseId> --api https://mysterytrove-api.fly.dev --publish
   ```

   `ADMIN_TOKEN` is a **Fly secret**, not in `.env` — without it the route
   403s (fail-closed). Omit `--publish` to land as a reviewable draft.
3. Commit the definition change too, so the image and DB agree.

Existing playthroughs keep the `contentVersion` they started on; only new
playthroughs pick up the latest published version. Bundle uploads are
capped at 52MB (`bundle.ts` enforces per-asset caps below that).

## Custom domains

```bash
# Web on the apex + www
fly certs add -a mysterytrove-web mysterytrove.com
fly certs add -a mysterytrove-web www.mysterytrove.com

# API on a subdomain
fly certs add -a mysterytrove-api api.mysterytrove.com
```

DNS (at the registrar): `A`/`AAAA` records for the apex pointing at
the web app's dedicated IPs (`fly ips list -a mysterytrove-web`),
CNAMEs for `www` and `api` to the respective `.fly.dev` hostnames.

After the domains exist, switch the pieces that reference hostnames:

1. `fly.web.toml` `[build.args]` → `NEXT_PUBLIC_API_URL = "https://api.mysterytrove.com"`, then redeploy web (build-time value).
2. `fly.api.toml` `[env] CORS_ORIGINS` already lists the custom domains; adjust if they change.
3. Resend: verify `mysterytrove.com` as a sending domain, then set `MAIL_FROM`.
4. Stripe (when live): point the webhook at `https://api.mysterytrove.com/v1/billing/webhook`.

## Notes

- **Warm machines**: both apps keep `min_machines_running = 1` so the
  landing page and mid-game turns never eat a cold start. Drop to 0 to
  save a few dollars a month at the cost of first-hit latency.
- **Health check**: the API's check hits `/v1/cases`, which exercises
  DB connectivity, not just the process.
- **Scaling**: playthrough state is in Postgres and the registry cache
  is per-instance and derived, so `fly scale count 2 -a
  mysterytrove-api` is safe.
- **Neon**: the connection string must keep `sslmode=require`. The
  pooler endpoint (`-pooler`) is fine for the API's pg Pool.
