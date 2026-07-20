# Subscriptions, Accounts & Tiered Access

**Status:** Implemented (API) — UI pages pending; Stripe/Resend keys required to activate
**Date:** 2026-07-20
**Related:** [MYSTERY_BUNDLES.md](./MYSTERY_BUNDLES.md) (access model this extends)

---

## 1. Tiers

`free < standard < premium < elite`

| Tier | What it is |
|------|------------|
| `free` | Anonymous or signed-in without a subscription. Free mysteries + seasonal windows. |
| `standard` | The regular shelf. |
| `premium` | Standard + the advanced/super-hard mysteries. |
| `elite` | **Invitation-only.** Its mysteries can be completely invisible to everyone else (`hiddenBelowTier`), and the subscribe page never lists it without a valid invite link. |

A user's **effective tier** = their subscribed tier while
`subscription_status ∈ {active, trialing, past_due (grace), comp}` — anything
else falls back to `free`. Started playthroughs are grandfathered (access is
checked at start only).

## 2. Access policy extensions (per mystery, config-driven)

On top of the existing policy (MYSTERY_BUNDLES §6):

```jsonc
{
  "visibility": "public",
  "minTier": "premium",                 // tier required to play
  "hiddenBelowTier": "elite",           // below this tier: behaves like private (404, unlisted)
  "freeWindows": [                      // seasonal free: tier gate waived during the window
    { "from": "2026-10-01T00:00:00Z", "until": "2026-10-08T00:00:00Z" }
  ]
}
```

- **Free mysteries**: `minTier: "free"` (the default) — set per case via
  `PUT /v1/mysteries/:caseId/access`.
- **Seasonal free**: while a `freeWindows` entry is active, the tier gate is
  waived (progression/series gates still apply) and the catalog carries
  `freeUntil` for the shelf badge ("Free until Sunday"). New starts lock
  again when the window lapses; in-flight runs continue.
- **Visible-but-locked vs not-visible**: `minTier` alone → listed with
  `lockReason: "tier"` (merchandising). `hiddenBelowTier` → does not exist
  below that tier: absent from catalog, 404 by URL, assets 404. Grants
  bypass both (invited playtesters).

## 3. Accounts (magic-link email via Resend)

- `POST /v1/auth/magic-link {email}` → one-time link (15 min TTL) emailed
  via Resend. Without `RESEND_API_KEY` (local dev) the link is logged to
  the console and returned as `devLink`.
- `POST /v1/auth/verify {token}` → creates the user (by email) and a 30-day
  DB session, set as an httpOnly `mystery_session` cookie. **Adopts the
  anonymous cookie's playthroughs** so solved-count progression follows the
  player into their account.
- `POST /v1/auth/signout`, `GET /v1/me` (user + effective tier +
  subscription state; or `{anonymous, userId, tier}`).
- Anonymous play: an httpOnly `mystery_anon` cookie is minted on first
  contact; anonymous players are `free` tier.
- The old `x-user-id` / `x-user-tier` headers are **dev-only overrides**
  (ignored when `NODE_ENV=production`).

## 4. Stripe

One Product per paid tier; price ids in env. Stripe hosts all payment UI —
we never touch card data.

| Route | Purpose |
|-------|---------|
| `GET /v1/billing/tiers[?invite=CODE]` | Cards for the subscribe page (live prices when configured). **Elite is omitted unless the invite is valid.** |
| `POST /v1/billing/checkout {tier, inviteCode?}` | 401 unless signed in; elite requires a valid invitation. Creates/reuses the Stripe customer, returns the Checkout Session URL. |
| `POST /v1/billing/portal` | Stripe Billing Portal URL (upgrade/downgrade/cancel; proration handled by Stripe). |
| `POST /v1/billing/webhook` | Signature-verified, idempotent (billing_events). **Single source of truth for `users.tier`.** |

Webhook handling: `checkout.session.completed` binds customer↔user and
redeems the invitation; `customer.subscription.created/updated/deleted`
maps price→tier and updates status/period-end/cancel-at-period-end. Dead
statuses (`canceled`, `unpaid`, `incomplete*`, `paused`) drop to `free`.

Unconfigured (no `STRIPE_SECRET_KEY`): billing routes return 501; manual
comps still work: `POST /v1/admin/users/tier {email, tier, status:"comp"}`.

## 5. Invitations (elite)

- `POST /v1/invitations {tier, code?, expiresAt?, maxUses?}` (admin) →
  mints `MYST-XXXX-XXXX`.
- `GET /v1/invitations/:code` → `{valid, tier}` (public — the subscribe
  page validates invite links).
- Elite checkout requires a valid code; it is redeemed on
  `checkout.session.completed`.
- Full elite invisibility = invitation-gated *subscription* +
  `hiddenBelowTier: "elite"` on the mysteries themselves.

## 6. Environment

```
RESEND_API_KEY=            # magic-link email (console fallback without it)
MAIL_FROM="Mystery <post@yourdomain>"
WEB_ORIGIN=http://localhost:3000

STRIPE_SECRET_KEY=         # test mode first
STRIPE_WEBHOOK_SECRET=     # from `stripe listen --forward-to localhost:8787/v1/billing/webhook`
STRIPE_PRICE_STANDARD=price_…
STRIPE_PRICE_PREMIUM=price_…
STRIPE_PRICE_ELITE=price_…

ADMIN_TOKEN=               # gates upload/publish/access/grants/invitations/admin routes
DEFAULT_USER_TIER=         # dev-only default for the header override
```

## 7. UI contracts (web pages — UI agent)

| Page | Uses |
|------|------|
| `/subscribe[?invite=CODE]` | `GET /v1/billing/tiers` cards → `POST /v1/billing/checkout` → redirect to `url`; handle `?checkout=cancelled` |
| `/account/billing` | `GET /v1/me` (tier, status, renewal, cancelAtPeriodEnd) + `POST /v1/billing/portal` button; handle `?checkout=success` |
| `/signin` | `POST /v1/auth/magic-link`; `/signin/verify?token=` → `POST /v1/auth/verify` (cookie set; show adopted-runs toast) |
| Shelf | catalog `locked/lockReason/requirement` (tier CTA → `/subscribe`) + `freeUntil` badge |
| All API calls | `credentials: "include"` (cookies carry identity) |

## 8. Security notes

- Webhook: raw-body signature verification + event-id idempotency ledger.
- Cookies: httpOnly, SameSite=Lax, Secure in production. Web and API must
  share a registrable domain in production (e.g. `www.` + `api.`).
- Dev identity headers are disabled in production builds.
- Anti-enumeration holds for tier-hidden mysteries exactly as for private
  ones (404, absent from catalog and asset routes).

## 9. Gaps / later

- Yearly prices, promo codes UI (checkout already allows promotion codes).
- Email templates beyond the minimal magic-link letter.
- Rate limiting on magic-link requests (per email/IP).
- Account page: session list / revoke-all.
- Webhook retries beyond Stripe's own (current handler is idempotent).
