# Security

## 1. What we're protecting (data classification)

**The mystery definition — above all, the solution — is the most sensitive data we
hold.** Each `definition.json` carries the culprit, method, motive, canon timeline,
the `revelation` document, character `shortBio` secrets, and the solution rubric.
Leaking any of it destroys the product: the entire value proposition is that the
answer stays sealed until the player earns it, and a spoiled case can't be un-spoiled.

By deliberate design we hold **no payment data**. Cards, checkout, and the billing
portal are entirely Stripe-hosted; we store only a Stripe customer id and a
subscription status (see [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md)). Stripe carries the
payment risk so we don't.

The practical consequence — and the rule for every future change:

> Weight "**could this expose a case's solution?**" as the highest-priority security
> question. It ranks above billing, above account data. Payment is outsourced; the
> story-secret is ours alone and irreplaceable.

## 2. Where the sensitive data lives

The full definition (with all spoilers) exists in three places:

- **Repo:** `content/cases/<case>/definition.json` — authoring source of truth.
- **API image:** baked in via `COPY content content` in `Dockerfile.api`.
- **Postgres:** imported at boot into `mysteries.definition` (jsonb) — what the running
  API reads from (see [MYSTERY_BUNDLES.md](./MYSTERY_BUNDLES.md)).

The solution is **unencrypted at rest** in the image and DB. Access to either
(Fly image-pull, or the `DATABASE_URL`) is effectively full answer-key access —
treat those credentials accordingly.

## 3. How the solution is kept from players

No player-reachable surface serves the raw definition or its secrets:

- **Sealed from prompts during play.** The active-play context pack tells the model
  "solution sealed until judged"; the confession text (`Truth: …method…motive…`) is
  only added to a character's knowledge once the case is judged (`case_solved`). So
  even a successful jailbreak of the narrator can't reveal what isn't in its context.
- **Engine-owned flags are off-limits to the AI.** `case_solved` / `case_failed`
  (`packages/engine/src/flags.ts` `RESERVED_FLAGS`) are stripped from every
  LLM-proposed write — the director's `suggestedPatch.setFlags` and the world→player
  `set_game_flag` effect — and only `resolve-case.ts` writes them. On a boundary turn
  the director's world→player effects are dropped entirely. This closes the one path
  by which prompt injection could flip the gate and leak the solution.
- **Filtered API responses.** `/v1/cases` and `/v1/cases/:id` return only marketing
  fields (meta, player persona, cast `cardTitle`) — never `shortBio`, solution, canon,
  or revelation. `publicState` ships an ending's `title`/`kind` but never its
  `templateNotes` (which name the culprit).
- **No asset route can serve it.** `definition.json` is excluded from `mystery_assets`
  on both import paths (`registry.ts` `collectDirAssets`, `bundle.ts` `parseBundle`),
  and uploads reject any orphan/non-image file. `getAsset` is an exact-path DB lookup,
  so `/v1/cases/:id/assets/definition.json` 404s; asset paths are also traversal-sanitized.
- **Closed-case reveals are ownership-scoped.** The `revelation` and the `/debrief`
  LLM endpoint (both of which expose solution content) are gated behind the
  per-playthrough ownership check — a leaked id no longer exposes another player's answer.

## 4. Boundaries & abuse

- **Boundary detector** (`packages/engine/src/boundaries.ts`) flags jailbreak/OOC,
  direct solution-fishing, abuse, genre-breaking powers, and extreme illegal actions —
  locally (regex) and via the director LLM — then neutralizes the turn (strips
  state-changing patch fields, skips the accuse gate) and instructs the performer to
  deflect without spoiling.
- **Accusation scoring is deterministic** against the sealed rubric; a coerced or false
  accusation cannot force a win.
- Turn input is capped (500 chars; debrief 2000), turns are rate-limited (per user +
  per playthrough, one in-flight, a hard turn cap), and every LLM call has a `max_tokens`
  ceiling with bounded retries.

## 5. Residual exposures to watch

- **Mystery Studio has no auth.** `apps/studio` serves raw `definition.json` from disk
  (`GET /api/cases/<dir>`) with no authentication. It is protected only by "never
  deployed" — no `Dockerfile.studio`, absent from CI/Fly, binds to localhost:3100.
  **Never expose that port** (tunnel, `-H 0.0.0.0`, reverse proxy) without adding an
  auth gate first; doing so puts every spoiler one unauthenticated GET away.
- **At-rest secrecy.** Solutions are unencrypted in the API image and Postgres; guard
  Fly org access and `DATABASE_URL`.
- **Prompt-injection can steer prose but not extract sealed secrets.** Player text is
  currently concatenated into prompts un-delimited, so injection can influence tone/
  narration; it cannot reach the solution because the solution isn't in context.
  Fencing player input in an unspoofable delimiter is a hardening item.

## 6. Auth / infrastructure invariants

- Every `/v1/playthroughs/:id*` route enforces object-level ownership (`ownsPlaythrough`).
- The dev identity override (`x-user-id` / `x-user-tier`) requires `ALLOW_DEV_AUTH=1`
  **and** non-production `NODE_ENV`; the API refuses to boot if the flag is set under
  production. Prod images bake `NODE_ENV=production`.
- Admin routes fail closed (deny when `ADMIN_TOKEN` is unset); the token is compared
  in constant time.
- Stripe webhooks are signature-verified against the raw body and idempotent; a failed
  apply releases the ledger claim so retries reprocess. `effectiveTier` enforces
  `current_period_end` as a time backstop.
- All SQL is parameterized. Sessions/anon cookies are `HttpOnly` + `SameSite=Lax` +
  `Secure` in prod. CORS uses an exact HTTPS allowlist. CI actions are SHA-pinned.
  Web responses carry HSTS / anti-clickjacking / nosniff headers; containers run non-root.
