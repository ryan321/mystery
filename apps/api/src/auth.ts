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
  current_period_end?: Date | null;
}): Tier {
  const tier = TIER_ORDER.includes(user.tier as Tier)
    ? (user.tier as Tier)
    : "free";
  if (tier === "free") return "free";
  if (
    !user.subscription_status ||
    !ENTITLED_STATUSES.has(user.subscription_status)
  ) {
    return "free";
  }
  // Time-based backstop: if a terminal webhook (cancel/downgrade) is ever
  // missed, the stored period end still revokes access once it lapses. `comp`
  // is complimentary access with no Stripe period, so it is exempt.
  if (
    user.subscription_status !== "comp" &&
    user.current_period_end &&
    user.current_period_end.getTime() < Date.now()
  ) {
    return "free";
  }
  return tier;
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The magic-link email, styled after the site: night-navy ground, a
 * candle-gold bordered panel, serif headline, mono uppercase eyebrows,
 * and the ornamental divider from the landing page. Email-safe: table
 * layout, inline styles, solid-color fallbacks under every gradient, and
 * web fonts (Cinzel) that degrade to Georgia/serif in Gmail & Outlook.
 */
function magicLinkEmailHtml(link: string): string {
  const webOrigin = process.env.WEB_ORIGIN ?? "https://mysterytrove.com";
  // Email-safe logo: the transparent webp gets mangled by image proxies
  // (Gmail rasterizes the alpha to a black box), so we serve a PNG with
  // the panel color (#0b1018) baked in — it blends in by construction.
  const logoUrl = `${webOrigin}/brand/logo-email.png`;
  const href = escapeHtml(link);

  const candle = "#d4b56a";
  const candleDim = "#8a7348";
  const fog = "#9aafc4";
  const serif = `Cinzel, 'Playfair Display', Georgia, 'Times New Roman', serif`;
  const mono = `'Courier New', Courier, monospace`;

  // Outlook enforces a minimum cell height, so a background-colored cell
  // becomes a thick bar; a 1px bottom border stays a hairline everywhere.
  const divider = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="220" align="center" style="margin:0 auto;">
        <tr>
          <td style="font-size:1px;line-height:1px;border-bottom:1px solid ${candleDim};">&nbsp;</td>
          <td width="28" align="center" style="color:${candle};font-size:10px;line-height:1;">&#9670;</td>
          <td style="font-size:1px;line-height:1px;border-bottom:1px solid ${candleDim};">&nbsp;</td>
        </tr>
      </table>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>A sealed letter arrives</title>
  <!--[if !mso]><!-->
  <style>@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap');</style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#05080e;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Your one-time link to step inside the mystery &mdash; it burns away in 15 minutes.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#05080e;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#0b1018;border:1px solid #2a3a4a;border-top:2px solid ${candle};">
          <tr>
            <td align="center" style="padding:40px 40px 8px;">
              <img src="${logoUrl}" alt="MYSTERY TROVE" width="180"
                style="display:block;border:0;width:180px;max-width:60%;height:auto;margin:0 auto;color:${candle};font-family:${serif};font-size:18px;letter-spacing:6px;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 40px 0;">
              <p style="margin:0;font-family:${mono};font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${candle};">A sealed letter arrives</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 40px 0;">
              <h1 style="margin:0;font-family:${serif};font-size:26px;font-weight:700;line-height:1.3;letter-spacing:1px;text-transform:uppercase;color:#e8dfd0;">A letter arrives for you</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 48px 0;">
              <p style="margin:0;font-family:Georgia, 'Times New Roman', serif;font-size:15px;line-height:1.7;color:${fog};">
                Someone asked for entry to Mystery Trove under your name. If it was
                you, the door stands open &mdash; but only for the next fifteen minutes.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 40px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" bgcolor="${candle}"
                    style="border:1px solid #e8cd8a;background:${candle};background:linear-gradient(180deg,#e3c47e 0%,${candle} 55%,#b8985a 100%);">
                    <a href="${href}"
                      style="display:inline-block;padding:13px 36px;font-family:${serif};font-size:15px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#12161c;text-decoration:none;">
                      Step Inside
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 40px 0;">
              <p style="margin:0;font-family:${mono};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${candleDim};">The link burns away in 15 minutes</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 48px 0;">
              ${divider}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 48px 0;">
              <a href="${href}" style="font-family:Georgia, 'Times New Roman', serif;font-size:11px;line-height:1.6;color:#5a6a7c;word-break:break-all;">${href}</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 48px 36px;">
              <p style="margin:0;font-family:Georgia, 'Times New Roman', serif;font-size:12px;font-style:italic;line-height:1.6;color:#5a6a7c;">
                If you didn't request this, ignore it &mdash; nothing will follow you.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-family:${mono};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${candleDim};" align="center">
          MysteryTrove.com &middot; mysteries you step inside and solve
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function magicLinkEmailText(link: string): string {
  return [
    "A letter arrives for you.",
    "",
    "Someone asked for entry to Mystery Trove under your name. If it was",
    "you, the door stands open — for the next fifteen minutes.",
    "",
    `Step inside: ${link}`,
    "",
    "If you didn't request this, ignore it — nothing will follow you.",
    "",
    "— MysteryTrove.com · mysteries you step inside and solve",
  ].join("\n");
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
      subject: "A sealed letter arrives",
      html: magicLinkEmailHtml(args.link),
      text: magicLinkEmailText(args.link),
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
  // No mailer configured. In production this is a misconfiguration, not a
  // dev convenience: never return the sign-in token in the response body
  // (that would be account takeover for any email). Fail closed instead.
  if (process.env.NODE_ENV === "production") {
    throw new EmailSendError("email_not_configured");
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
