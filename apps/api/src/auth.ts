/**
 * Accounts & sessions (docs/SUBSCRIPTIONS.md Phase 1).
 *
 * Magic-link email auth: POST /v1/auth/magic-link emails a one-time link
 * (Resend); verifying it creates the user (by email) and a DB session,
 * delivered as an httpOnly cookie. Anonymous visitors can browse but
 * not play (POST /v1/playthroughs requires an account); sign-in adopts
 * any legacy anon playthroughs so old progression follows the player in.
 *
 * Without RESEND_API_KEY (local dev) the link is logged to the console
 * and returned in the response as devLink.
 */
import { randomBytes } from "node:crypto";
import type { Db } from "./db.js";
import type { Tier } from "./access.js";
import { TIER_ORDER } from "./access.js";
import { safeNextPath } from "./google-auth.js";

export const SESSION_COOKIE = "mystery_session";
export const ANON_COOKIE = "mystery_anon";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Subscription statuses that keep the paid tier active. */
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due", "comp"]);

export type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  tier: string;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
};

/** The tier the user is actually entitled to right now. */
export function effectiveTier(user: {
  tier: string;
  subscription_status: string | null;
}): Tier {
  const tier = TIER_ORDER.includes(user.tier as Tier)
    ? (user.tier as Tier)
    : "free";
  if (tier === "free") return "free";
  return user.subscription_status &&
    ENTITLED_STATUSES.has(user.subscription_status)
    ? tier
    : "free";
}

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name ?? user.email.split("@")[0],
    tier: effectiveTier(user),
    subscription: {
      tier: user.tier,
      status: user.subscription_status,
      currentPeriodEnd: user.current_period_end?.toISOString(),
      cancelAtPeriodEnd: user.cancel_at_period_end,
    },
  };
}

function token(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/**
 * Raised when the magic-link email can't be handed off to Resend — a missing
 * key, or a non-2xx from the API (e.g. an unverified/misconfigured MAIL_FROM
 * sender, which Resend rejects with 403). Carries the upstream status/body so
 * the route can log the real cause instead of an opaque 500.
 */
export class EmailSendError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly detail?: string
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

async function sendViaResend(args: {
  to: string;
  link: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new EmailSendError("resend_not_configured");
  const from =
    process.env.MAIL_FROM ?? "Mystery <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: args.to,
      subject: "Your entry to the mystery",
      html: [
        `<p>A letter arrives for you.</p>`,
        `<p><a href="${args.link}">Step inside</a> — this link expires in 15 minutes.</p>`,
        `<p>If you didn't request this, ignore it. Nothing will follow you.</p>`,
      ].join("\n"),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new EmailSendError(
      `resend_failed_${res.status}`,
      res.status,
      body.slice(0, 500)
    );
  }
}

export async function requestMagicLink(
  pool: Db,
  rawEmail: string,
  next?: string
): Promise<{ sent: boolean; devLink?: string } | { error: string }> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { error: "invalid_email" };

  const t = token();
  await pool.query(
    `INSERT INTO login_tokens (token, email, expires_at) VALUES ($1, $2, $3)`,
    [t, email, new Date(Date.now() + MAGIC_LINK_TTL_MS)]
  );

  const webOrigin = process.env.WEB_ORIGIN ?? "https://mysterytrove.com";
  const link = `${webOrigin}/signin/verify?token=${t}&next=${encodeURIComponent(
    safeNextPath(next)
  )}`;

  if (process.env.RESEND_API_KEY) {
    await sendViaResend({ to: email, link });
    return { sent: true };
  }
  // Local dev without Resend: the link is the console + response.
  console.log(`[auth] magic link for ${email}: ${link}`);
  return { sent: true, devLink: link };
}

export async function verifyMagicLink(
  pool: Db,
  rawToken: string
): Promise<{ user: UserRow; sessionToken: string } | { error: string }> {
  const res = await pool.query<{ email: string }>(
    `UPDATE login_tokens SET used_at = now()
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING email`,
    [rawToken]
  );
  const email = res.rows[0]?.email;
  if (!email) return { error: "invalid_or_expired_token" };

  const userRes = await pool.query<UserRow>(
    `INSERT INTO users (email) VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [email]
  );
  const user = userRes.rows[0]!;
  const sessionToken = await createSession(pool, user.id);
  return { user, sessionToken };
}

export async function createSession(
  pool: Db,
  userId: string
): Promise<string> {
  const sessionToken = token();
  await pool.query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [sessionToken, userId, new Date(Date.now() + SESSION_TTL_MS)]
  );
  return sessionToken;
}

export type GoogleProfile = {
  /** Google's stable subject id. */
  sub: string;
  email: string;
  name?: string;
};

/**
 * Google sign-in converges on the same users table: match by google_sub
 * first (email at Google may change), else link/create by email — a
 * magic-link account signing in with Google becomes one account.
 */
export async function upsertGoogleUser(
  pool: Db,
  profile: GoogleProfile
): Promise<UserRow> {
  const bySub = await pool.query<UserRow>(
    `UPDATE users SET updated_at = now(),
       display_name = COALESCE(display_name, $2)
     WHERE google_sub = $1 RETURNING *`,
    [profile.sub, profile.name ?? null]
  );
  if (bySub.rows[0]) return bySub.rows[0];

  const email = normalizeEmail(profile.email);
  if (!email) throw new Error("google_profile_invalid_email");
  const res = await pool.query<UserRow>(
    `INSERT INTO users (email, google_sub, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET
       google_sub   = COALESCE(users.google_sub, EXCLUDED.google_sub),
       display_name = COALESCE(users.display_name, EXCLUDED.display_name),
       updated_at   = now()
     RETURNING *`,
    [email, profile.sub, profile.name ?? null]
  );
  return res.rows[0]!;
}

export async function userForSession(
  pool: Db,
  sessionToken: string
): Promise<UserRow | null> {
  const res = await pool.query<UserRow>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [sessionToken]
  );
  return res.rows[0] ?? null;
}

export async function destroySession(
  pool: Db,
  sessionToken: string
): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE token = $1`, [sessionToken]);
}

export async function getUserByEmail(
  pool: Db,
  rawEmail: string
): Promise<UserRow | null> {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;
  const res = await pool.query<UserRow>(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );
  return res.rows[0] ?? null;
}

/** Sign-in adopts the anonymous cookie's playthroughs (progression merge). */
export async function adoptAnonPlaythroughs(
  pool: Db,
  userId: string,
  anonId: string
): Promise<number> {
  if (!anonId) return 0;
  const res = await pool.query(
    `UPDATE playthroughs SET user_id = $1 WHERE user_id = $2`,
    [userId, anonId]
  );
  return res.rowCount ?? 0;
}

export function newAnonId(): string {
  return `anon_${token(12)}`;
}
