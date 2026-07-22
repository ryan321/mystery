/**
 * Stripe subscriptions (docs/SUBSCRIPTIONS.md Phase 3–4).
 *
 * - One Stripe Product per paid tier; price ids via env
 *   (STRIPE_PRICE_STANDARD / STRIPE_PRICE_PREMIUM / STRIPE_PRICE_ELITE).
 * - Checkout + Billing Portal are Stripe-hosted (we never touch cards).
 * - The webhook is the single source of truth for users.tier: signature
 *   verified, idempotent via billing_events.
 * - Elite is invitation-only: checkout requires a valid invitation code,
 *   and the subscribe page only shows elite via an invite link.
 * - Without STRIPE_SECRET_KEY everything degrades to 501
 *   billing_not_configured; manual comps still work via the admin route.
 */
import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import type { Db } from "./db.js";
import type { Tier } from "./access.js";

export const PAID_TIERS = ["standard", "premium", "elite"] as const;
export type PaidTier = (typeof PAID_TIERS)[number];

export function isPaidTier(v: unknown): v is PaidTier {
  return PAID_TIERS.includes(v as PaidTier);
}

let stripeSingleton: Stripe | null | undefined;
export function stripeClient(): Stripe | null {
  if (stripeSingleton !== undefined) return stripeSingleton;
  const key = process.env.STRIPE_SECRET_KEY;
  stripeSingleton = key ? new Stripe(key) : null;
  return stripeSingleton;
}

export function priceForTier(tier: PaidTier): string | undefined {
  const env = {
    standard: process.env.STRIPE_PRICE_STANDARD,
    premium: process.env.STRIPE_PRICE_PREMIUM,
    elite: process.env.STRIPE_PRICE_ELITE,
  } as const;
  return env[tier] || undefined;
}

export function tierForPrice(priceId: string): PaidTier | undefined {
  for (const tier of PAID_TIERS) {
    if (priceForTier(tier) === priceId) return tier;
  }
  return undefined;
}

/** Marketing copy for the subscribe page; prices come from Stripe. */
export const TIER_CARDS: Record<
  PaidTier,
  { name: string; blurb: string; inviteOnly?: boolean }
> = {
  standard: {
    name: "Sleuth",
    blurb: "The full shelf of mysteries, with fresh cases as they’re released.",
  },
  premium: {
    name: "Master Detective",
    blurb:
      "Everything a Sleuth gets, plus the advanced cases — longer nights, harder truths.",
  },
  elite: {
    name: "The Inner Circle",
    blurb:
      "By invitation only. Mysteries that appear on no shelf you’ve seen.",
    inviteOnly: true,
  },
};

/** Normalized subscription state extracted from a Stripe event object. */
export type SubscriptionUpdate = {
  customerId: string;
  status: string;
  priceId?: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
};

export function subscriptionUpdateFrom(
  sub: Stripe.Subscription
): SubscriptionUpdate {
  const item = sub.items?.data?.[0];
  const periodEnd = item?.current_period_end;
  return {
    customerId:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    status: sub.status,
    priceId: item?.price?.id,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  };
}

/** Statuses that end entitlement immediately. */
const DEAD_STATUSES = new Set([
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

export function tierForSubscription(u: SubscriptionUpdate): Tier {
  if (DEAD_STATUSES.has(u.status)) return "free";
  const tier = u.priceId ? tierForPrice(u.priceId) : undefined;
  return tier ?? "free";
}

export async function applySubscriptionUpdate(
  pool: Db,
  u: SubscriptionUpdate
): Promise<void> {
  await pool.query(
    `UPDATE users SET
       tier = $2,
       subscription_status = $3,
       current_period_end = $4,
       cancel_at_period_end = $5,
       updated_at = now()
     WHERE stripe_customer_id = $1`,
    [
      u.customerId,
      tierForSubscription(u),
      u.status,
      u.currentPeriodEnd ?? null,
      u.cancelAtPeriodEnd,
    ]
  );
}

/** Idempotency ledger: true when this event id is new. */
export async function recordBillingEvent(
  pool: Db,
  eventId: string,
  type: string
): Promise<boolean> {
  const res = await pool.query(
    `INSERT INTO billing_events (event_id, type) VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, type]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function bindStripeCustomer(
  pool: Db,
  userId: string,
  customerId: string
): Promise<void> {
  await pool.query(
    `UPDATE users SET stripe_customer_id = $2, updated_at = now()
     WHERE id = $1`,
    [userId, customerId]
  );
}

// ── Invitations (elite gate) ────────────────────────────────────────────

export function newInviteCode(): string {
  // Readable, unambiguous: MYST-XXXX-XXXX
  const raw = randomBytes(8)
    .toString("base64url")
    .replace(/[-_]/g, "")
    .toUpperCase()
    .slice(0, 8);
  return `MYST-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export async function mintInvitation(
  pool: Db,
  args: { tier: PaidTier; code?: string; expiresAt?: string; maxUses?: number }
): Promise<string> {
  const code = args.code?.trim() || newInviteCode();
  await pool.query(
    `INSERT INTO invitations (code, tier, expires_at, max_uses)
     VALUES ($1, $2, $3, $4)`,
    [
      code,
      args.tier,
      args.expiresAt ? new Date(args.expiresAt) : null,
      Math.max(1, args.maxUses ?? 1),
    ]
  );
  return code;
}

export async function validateInvitation(
  pool: Db,
  code: string,
  tier?: PaidTier
): Promise<{ valid: boolean; tier?: PaidTier }> {
  const res = await pool.query<{
    tier: string;
    expires_at: Date | null;
    max_uses: number;
    use_count: number;
  }>(`SELECT tier, expires_at, max_uses, use_count FROM invitations WHERE code = $1`, [
    code.trim(),
  ]);
  const row = res.rows[0];
  if (!row) return { valid: false };
  if (row.expires_at && row.expires_at < new Date()) return { valid: false };
  if (row.use_count >= row.max_uses) return { valid: false };
  if (tier && row.tier !== tier) return { valid: false };
  return { valid: true, tier: row.tier as PaidTier };
}

export async function redeemInvitation(
  pool: Db,
  code: string
): Promise<void> {
  await pool.query(
    `UPDATE invitations SET use_count = use_count + 1 WHERE code = $1`,
    [code.trim()]
  );
}
