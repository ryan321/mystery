import type {
  CaseDetail,
  CaseSummary,
  GetPlaythroughResponse,
  NoteResponse,
  SendTurnResponse,
  StartCaseResponse,
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
 */
async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, { credentials: "include", ...init });
}

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string; message?: string };
  if (!res.ok) {
    // Prefer the human-readable message (rate limits, turn-in-flight) over
    // the machine code; callers that branch on a code (signin_required)
    // still get it — those responses carry no message field.
    throw new Error(data.message ?? data.error ?? `API ${res.status}`);
  }
  return data;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function listCases(): Promise<CaseSummary[]> {
  const data = await json<{ cases: CaseSummary[] }>(await apiFetch("/v1/cases"));
  return data.cases;
}

export async function getCase(caseId: string): Promise<CaseDetail> {
  return json<CaseDetail>(await apiFetch(`/v1/cases/${caseId}`));
}

export async function startCase(caseId: string): Promise<StartCaseResponse> {
  const res = await apiFetch("/v1/playthroughs", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ caseId }),
  });
  return json<StartCaseResponse>(res);
}

export async function getPlaythrough(id: string): Promise<GetPlaythroughResponse> {
  return json<GetPlaythroughResponse>(await apiFetch(`/v1/playthroughs/${id}`));
}

export async function sendTurn(
  id: string,
  input: string
): Promise<SendTurnResponse> {
  const res = await apiFetch(`/v1/playthroughs/${id}/turns`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ input }),
  });
  return json<SendTurnResponse>(res);
}

// ── Auth (magic link + session; Google lives at /v1/auth/google) ────────

export type MeResponse = {
  user?: { id: string; email: string; displayName: string; tier: string };
  anonymous?: boolean;
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
