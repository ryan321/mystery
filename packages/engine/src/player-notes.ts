import type { NotebookEntry } from "@mystery/shared";

/**
 * Player scratchpad notes (PLAYER_SURFACES.md §5.6).
 *
 * Player notes are deliberately inert: never parsed by the engine, never
 * sent to any prompt. These helpers only enforce the write-side rules —
 * free text within size limits, and `source: "auto"` entries (the case's
 * own record) are immutable from the player side. All functions are pure:
 * they return a new notebook array instead of mutating state.
 */

export const PLAYER_NOTE_MAX_LENGTH = 2000;
export const PLAYER_NOTE_MAX_COUNT = 200;

export type PlayerNoteErrorCode =
  | "empty_note"
  | "note_too_long"
  | "too_many_notes"
  | "note_not_found"
  | "immutable_note";

export class PlayerNoteError extends Error {
  constructor(public readonly code: PlayerNoteErrorCode) {
    super(code);
    this.name = "PlayerNoteError";
  }
}

function cleanText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new PlayerNoteError("empty_note");
  if (trimmed.length > PLAYER_NOTE_MAX_LENGTH) {
    throw new PlayerNoteError("note_too_long");
  }
  return trimmed;
}

export function addPlayerNote(
  notebook: NotebookEntry[],
  text: string,
  meta: { id: string; now: string }
): { note: NotebookEntry; notebook: NotebookEntry[] } {
  const trimmed = cleanText(text);
  const playerCount = notebook.filter((e) => e.source === "player").length;
  if (playerCount >= PLAYER_NOTE_MAX_COUNT) {
    throw new PlayerNoteError("too_many_notes");
  }
  const note: NotebookEntry = {
    id: meta.id,
    text: trimmed,
    source: "player",
    createdAt: meta.now,
  };
  return { note, notebook: [...notebook, note] };
}

export function updatePlayerNote(
  notebook: NotebookEntry[],
  noteId: string,
  text: string
): { note: NotebookEntry; notebook: NotebookEntry[] } {
  const trimmed = cleanText(text);
  const index = notebook.findIndex((e) => e.id === noteId);
  if (index === -1) throw new PlayerNoteError("note_not_found");
  const existing = notebook[index];
  if (existing.source !== "player") throw new PlayerNoteError("immutable_note");
  const note: NotebookEntry = { ...existing, text: trimmed };
  const next = notebook.slice();
  next[index] = note;
  return { note, notebook: next };
}

export function deletePlayerNote(
  notebook: NotebookEntry[],
  noteId: string
): { notebook: NotebookEntry[] } {
  const existing = notebook.find((e) => e.id === noteId);
  if (!existing) throw new PlayerNoteError("note_not_found");
  if (existing.source !== "player") throw new PlayerNoteError("immutable_note");
  return { notebook: notebook.filter((e) => e.id !== noteId) };
}
