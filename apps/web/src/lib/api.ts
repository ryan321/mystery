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

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(data.error ?? data.message ?? `API ${res.status}`);
  }
  return data;
}

export async function listCases(): Promise<CaseSummary[]> {
  const res = await fetch(`${API}/v1/cases`);
  const data = await json<{ cases: CaseSummary[] }>(res);
  return data.cases;
}

export async function getCase(caseId: string): Promise<CaseDetail> {
  const res = await fetch(`${API}/v1/cases/${caseId}`);
  return json<CaseDetail>(res);
}

export async function startCase(caseId: string): Promise<StartCaseResponse> {
  const res = await fetch(`${API}/v1/playthroughs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId }),
  });
  return json<StartCaseResponse>(res);
}

export async function getPlaythrough(id: string): Promise<GetPlaythroughResponse> {
  const res = await fetch(`${API}/v1/playthroughs/${id}`);
  return json<GetPlaythroughResponse>(res);
}

export async function sendTurn(
  id: string,
  input: string
): Promise<SendTurnResponse> {
  const res = await fetch(`${API}/v1/playthroughs/${id}/turns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  return json<SendTurnResponse>(res);
}

// ── Player scratchpad notes (docs/PLAYER_SURFACES.md §5.6) ───────────────

export async function addNote(id: string, text: string): Promise<NoteResponse> {
  const res = await fetch(`${API}/v1/playthroughs/${id}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return json<NoteResponse>(res);
}

export async function updateNote(
  id: string,
  noteId: string,
  text: string
): Promise<NoteResponse> {
  const res = await fetch(`${API}/v1/playthroughs/${id}/notes/${noteId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return json<NoteResponse>(res);
}

export async function deleteNote(
  id: string,
  noteId: string
): Promise<NoteResponse> {
  const res = await fetch(`${API}/v1/playthroughs/${id}/notes/${noteId}`, {
    method: "DELETE",
  });
  return json<NoteResponse>(res);
}
