import type {
  BillingTier,
  CaseDetail,
  CaseSummary,
  GeniusEligibility,
  GetPlaythroughResponse,
  NoteResponse,
  PlaythroughSummary,
  SendTurnResponse,
  StartCaseResponse,
  Subscription,
} from "./types";

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/** Resolve API-relative portrait path to absolute URL for <img src>. */
export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = API.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Plain dark panel for the rare bundle that ships no cover. */
const COVER_FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#12151c"/></svg>'
  );

/** Cover art for a gallery/detail card — bundle coverUrl or a neutral panel. */
export function coverSrc(c: { coverUrl?: string | null }): string {
  return assetUrl(c.coverUrl) ?? COVER_FALLBACK;
}

/**
 * PlayerView carries raw definition-relative asset paths (e.g.
 * "portraits/henshaw.jpg") — resolve them against the case asset route.
 */
export function playerAssetUrl(
  caseId: string,
  path?: string | null
): string | undefined {
  if (!path) return undefined;
  return assetUrl(`/v1/cases/${caseId}/assets/${path}`);
}

/**
 * All API calls carry credentials: the session cookie lives on the API
 * origin, and playthroughs/notes belong to the signed-in account.
 *
 * `timeoutMs` arms an AbortController so a stuck request fails predictably
 * instead of hanging forever (turns are the case that matters — see sendTurn).
 */
async function apiFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs?: number
): Promise<Response> {
  if (!timeoutMs) {
    return fetch(`${API}${path}`, { credentials: "include", ...init });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${API}${path}`, {
      credentials: "include",
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A turn is two LLM calls and normally returns in well under a minute; past
 * this it's a stuck connection (a crashed machine mid-turn, a dead socket).
 * Bound it so the UI shows a retry prompt instead of an endless spinner.
 */
const TURN_TIMEOUT_MS = 120_000;

async function json<T>(res: Response): Promise<T> {
  // Parse defensively: an upstream (proxy/CDN) failure or empty body isn't
  // JSON, and res.json() would throw an opaque SyntaxError over the real
  // status. null then falls through to the `API <status>` message below.
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string; message?: string })
    | null;
  if (!res.ok) {
    // Prefer the human-readable message (rate limits, turn-in-flight) over
    // the machine code; callers that branch on a code (signin_required)
    // still get it — those responses carry no message field.
    throw new Error(data?.message ?? data?.error ?? `API ${res.status}`);
  }
  return data as T;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function listCases(): Promise<CaseSummary[]> {
  const data = await json<{ cases: CaseSummary[] }>(await apiFetch("/v1/cases"));
  return data.cases;
}

export async function getCase(caseId: string): Promise<CaseDetail> {
  return json<CaseDetail>(await apiFetch(`/v1/cases/${caseId}`));
}

export async function startCase(
  caseId: string,
  restart = false
): Promise<StartCaseResponse> {
  const res = await apiFetch("/v1/playthroughs", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ caseId, restart }),
  });
  return json<StartCaseResponse>(res);
}

export async function getPlaythrough(id: string): Promise<GetPlaythroughResponse> {
  return json<GetPlaythroughResponse>(await apiFetch(`/v1/playthroughs/${id}`));
}

/** Account-wide play history (My Mysteries) — works across devices. */
export async function listMyPlaythroughs(): Promise<PlaythroughSummary[]> {
  const data = await json<{ playthroughs: PlaythroughSummary[] }>(
    await apiFetch("/v1/playthroughs")
  );
  return data.playthroughs;
}

export async function sendTurn(
  id: string,
  input: string
): Promise<SendTurnResponse> {
  let res: Response;
  try {
    res = await apiFetch(
      `/v1/playthroughs/${id}/turns`,
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ input }) },
      TURN_TIMEOUT_MS
    );
  } catch (e) {
    // Aborted by the deadline (or a dropped connection): surface a retryable
    // message rather than the raw AbortError. The turn may have committed
    // server-side, so reloading the playthrough will show it.
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("The turn is taking too long — try again in a moment.");
    }
    throw e;
  }
  return json<SendTurnResponse>(res);
}

/**
 * Accuse button: open the formal accusation ceremony (gather the household).
 * No form — the next freeform sendTurn is the charge.
 */
export async function beginAccusation(
  id: string
): Promise<SendTurnResponse> {
  let res: Response;
  try {
    res = await apiFetch(
      `/v1/playthroughs/${id}/accuse-begin`,
      { method: "POST", headers: JSON_HEADERS, body: "{}" },
      TURN_TIMEOUT_MS
    );
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("The turn is taking too long — try again in a moment.");
    }
    throw e;
  }
  return json<SendTurnResponse>(res);
}

// ── Auth (magic link + session; Google lives at /v1/auth/google) ────────

export type MeResponse = {
  user?: {
    id: string;
    email: string;
    displayName: string;
    tier: string;
    subscription?: Subscription;
  };
  /** Present for signed-in users: progress toward the earned Genius tier. */
  genius?: GeniusEligibility;
  anonymous?: boolean;
  tier?: string;
};

export async function requestMagicLink(
  email: string,
  next?: string
): Promise<{ sent: boolean; devLink?: string }> {
  const res = await apiFetch("/v1/auth/magic-link", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, next }),
  });
  return json<{ sent: boolean; devLink?: string }>(res);
}

export async function verifyMagicToken(token: string): Promise<void> {
  await json(
    await apiFetch("/v1/auth/verify", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ token }),
    })
  );
}

export async function fetchMe(): Promise<MeResponse> {
  return json<MeResponse>(await apiFetch("/v1/me"));
}

export async function apiSignOut(): Promise<void> {
  await apiFetch("/v1/auth/signout", { method: "POST" }).catch(() => {});
}

// ── Billing (Stripe checkout / portal; docs/SUBSCRIPTIONS.md §4) ──────────

export type BillingTiersResponse = {
  tiers: BillingTier[];
  /** False when STRIPE_SECRET_KEY is unset — checkout is unavailable. */
  billingConfigured: boolean;
};

export async function fetchBillingTiers(
  invite?: string
): Promise<BillingTiersResponse> {
  const q = invite ? `?invite=${encodeURIComponent(invite)}` : "";
  return json<BillingTiersResponse>(await apiFetch(`/v1/billing/tiers${q}`));
}

/**
 * Start a Stripe Checkout session and return its hosted URL. Throws with
 * the API's error code as the message ("sign_in_required",
 * "invitation_required", "billing_not_configured", …) so callers can branch.
 */
async function billingRedirectUrl(
  path: string,
  body?: unknown
): Promise<string> {
  const res = await apiFetch(path, {
    method: "POST",
    headers: JSON_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;
  if (!res.ok || !data?.url) {
    throw new Error(data?.error ?? `request_failed_${res.status}`);
  }
  return data.url;
}

export function startCheckout(
  tier: string,
  inviteCode?: string
): Promise<string> {
  return billingRedirectUrl("/v1/billing/checkout", {
    tier,
    ...(inviteCode ? { inviteCode } : {}),
  });
}

export function openBillingPortal(): Promise<string> {
  return billingRedirectUrl("/v1/billing/portal");
}

// ── Player scratchpad notes (docs/PLAYER_SURFACES.md §5.6) ───────────────

export async function addNote(id: string, text: string): Promise<NoteResponse> {
  const res = await apiFetch(`/v1/playthroughs/${id}/notes`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ text }),
  });
  return json<NoteResponse>(res);
}

export async function updateNote(
  id: string,
  noteId: string,
  text: string
): Promise<NoteResponse> {
  const res = await apiFetch(`/v1/playthroughs/${id}/notes/${noteId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ text }),
  });
  return json<NoteResponse>(res);
}

export async function deleteNote(
  id: string,
  noteId: string
): Promise<NoteResponse> {
  const res = await apiFetch(`/v1/playthroughs/${id}/notes/${noteId}`, {
    method: "DELETE",
  });
  return json<NoteResponse>(res);
}

// ── Player feedback (gameplay-screen "Send feedback" modal) ─────────────

export async function submitFeedback(id: string, text: string): Promise<void> {
  const res = await apiFetch(`/v1/playthroughs/${id}/feedback`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ text }),
  });
  await json<{ ok: boolean }>(res);
}
