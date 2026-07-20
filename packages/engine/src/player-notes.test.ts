import { describe, expect, it } from "vitest";
import type { NotebookEntry } from "@mystery/shared";
import {
  addPlayerNote,
  deletePlayerNote,
  PLAYER_NOTE_MAX_COUNT,
  PLAYER_NOTE_MAX_LENGTH,
  PlayerNoteError,
  updatePlayerNote,
} from "./player-notes.js";

const auto: NotebookEntry = {
  id: "a1",
  text: "Engine record",
  source: "auto",
  createdAt: "2026-07-20T00:00:00.000Z",
};
const player: NotebookEntry = {
  id: "p1",
  text: "It's Vale, I'm sure",
  source: "player",
  createdAt: "2026-07-20T00:00:00.000Z",
};
const meta = { id: "p2", now: "2026-07-20T01:00:00.000Z" };

describe("addPlayerNote", () => {
  it("appends a trimmed player note", () => {
    const { note, notebook } = addPlayerNote([auto], "  hello  ", meta);
    expect(note).toEqual({
      id: "p2",
      text: "hello",
      source: "player",
      createdAt: meta.now,
    });
    expect(notebook).toEqual([auto, note]);
  });

  it("does not mutate the input array", () => {
    const before = [auto];
    addPlayerNote(before, "x", meta);
    expect(before).toHaveLength(1);
  });

  it("rejects empty and whitespace-only text", () => {
    expect(() => addPlayerNote([], "   ", meta)).toThrowError(
      expect.objectContaining({ code: "empty_note" })
    );
  });

  it("rejects text over the length cap", () => {
    const long = "x".repeat(PLAYER_NOTE_MAX_LENGTH + 1);
    expect(() => addPlayerNote([], long, meta)).toThrowError(
      expect.objectContaining({ code: "note_too_long" })
    );
  });

  it("rejects when the player-note count cap is reached", () => {
    const full = Array.from({ length: PLAYER_NOTE_MAX_COUNT }, (_, i) => ({
      ...player,
      id: `p${i}`,
    }));
    expect(() => addPlayerNote(full, "one more", meta)).toThrowError(
      expect.objectContaining({ code: "too_many_notes" })
    );
    // Auto entries don't count toward the player cap.
    expect(() => addPlayerNote([auto, ...full.slice(1)], "ok", meta)).not.toThrow();
  });
});

describe("updatePlayerNote", () => {
  it("replaces text on a player note, keeping id/source/createdAt", () => {
    const { note, notebook } = updatePlayerNote([auto, player], "p1", "maybe Henshaw");
    expect(note).toEqual({ ...player, text: "maybe Henshaw" });
    expect(notebook[1]).toEqual(note);
    expect(notebook[0]).toEqual(auto);
  });

  it("rejects editing an auto entry", () => {
    expect(() => updatePlayerNote([auto], "a1", "tamper")).toThrowError(
      expect.objectContaining({ code: "immutable_note" })
    );
  });

  it("rejects unknown ids and empty text", () => {
    expect(() => updatePlayerNote([player], "nope", "x")).toThrowError(
      expect.objectContaining({ code: "note_not_found" })
    );
    expect(() => updatePlayerNote([player], "p1", "  ")).toThrowError(
      expect.objectContaining({ code: "empty_note" })
    );
  });
});

describe("deletePlayerNote", () => {
  it("removes a player note", () => {
    const { notebook } = deletePlayerNote([auto, player], "p1");
    expect(notebook).toEqual([auto]);
  });

  it("rejects deleting an auto entry or unknown id", () => {
    expect(() => deletePlayerNote([auto], "a1")).toThrowError(
      expect.objectContaining({ code: "immutable_note" })
    );
    expect(() => deletePlayerNote([player], "nope")).toThrowError(
      expect.objectContaining({ code: "note_not_found" })
    );
  });

  it("throws PlayerNoteError instances", () => {
    try {
      deletePlayerNote([], "x");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(PlayerNoteError);
    }
  });
});
