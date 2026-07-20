/**
 * Google sign-in — server-side OAuth 2.0 authorization-code flow with
 * OIDC (docs/SUBSCRIPTIONS.md Phase 1).
 *
 *   GET /v1/auth/google           → 302 to Google's consent screen
 *   GET /v1/auth/google/callback  → code exchange → session cookie →
 *                                   302 back to the web app
 *
 * The id_token arrives directly from Google's token endpoint over TLS,
 * so per OIDC Core §3.1.3.7 we validate claims (iss/aud/exp/
 * email_verified) without re-verifying the JWT signature.
 *
 * Unset GOOGLE_CLIENT_ID/SECRET → routes answer 501 (same pattern as
 * Stripe).
 */
import type { GoogleProfile } from "./auth.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const OAUTH_STATE_COOKIE = "mystery_oauth_state";
export const OAUTH_NEXT_COOKIE = "mystery_oauth_next";

export function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

/** Public origin of THIS api — Google redirects back here. */
export function apiOrigin(): string {
  return (
    process.env.API_ORIGIN ??
    `http://localhost:${process.env.PORT ?? 8787}`
  ).replace(/\/$/, "");
}

export function googleRedirectUri(): string {
  return `${apiOrigin()}/v1/auth/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

/**
 * Post-login destination must be a same-site path — never an absolute
 * URL (open-redirect guard). Falls back to the gallery.
 */
export function safeNextPath(raw: string | undefined): string {
  if (!raw) return "/gallery";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/gallery";
  }
  return raw;
}

/** Claim validation for an id_token obtained directly from Google. */
export function parseIdToken(
  idToken: string,
  clientId: string,
  nowMs = Date.now()
): GoogleProfile | { error: string } {
  const parts = idToken.split(".");
  if (parts.length !== 3) return { error: "malformed_id_token" };
  let claims: {
    iss?: string;
    aud?: string;
    exp?: number;
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { error: "malformed_id_token" };
  }
  if (
    claims.iss !== "https://accounts.google.com" &&
    claims.iss !== "accounts.google.com"
  ) {
    return { error: "wrong_issuer" };
  }
  if (claims.aud !== clientId) return { error: "wrong_audience" };
  if (!claims.exp || claims.exp * 1000 < nowMs) return { error: "expired" };
  if (!claims.sub) return { error: "missing_sub" };
  if (!claims.email || claims.email_verified !== true) {
    return { error: "email_not_verified" };
  }
  return { sub: claims.sub, email: claims.email, name: claims.name };
}

/** Exchange the authorization code for a validated Google profile. */
export async function exchangeGoogleCode(
  code: string
): Promise<GoogleProfile | { error: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`[auth] google token exchange failed ${res.status}:`, body.slice(0, 200));
    return { error: "code_exchange_failed" };
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) return { error: "no_id_token" };
  return parseIdToken(data.id_token, process.env.GOOGLE_CLIENT_ID ?? "");
}
