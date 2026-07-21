import { describe, expect, it } from "vitest";
import {
  narrationPresenceViolations,
  performerSoftFailure,
} from "./performer.js";

describe("performerSoftFailure", () => {
  it("flags empty narration", () => {
    expect(performerSoftFailure({ narration: "", dialogue: [], dressing: [] })).not.toBeNull();
    expect(performerSoftFailure({ narration: "   ", dialogue: [], dressing: [] })).not.toBeNull();
    expect(performerSoftFailure({ narration: "Hi", dialogue: [], dressing: [] })).not.toBeNull();
  });

  it("accepts real narration", () => {
    expect(
      performerSoftFailure({
        narration: "You step into the hall. Rain ticks the glass.",
        dressing: [],
        dialogue: [],
      })
    ).toBeNull();
  });

  it("flags absent people staged in the room", () => {
    const pack = {
      notPresentCharacters: [
        { id: "vale", name: "Mr. Vale" },
        { id: "mrs-blackwood", name: "Mrs. Blackwood" },
      ],
      location: { presentCharacterIds: ["henshaw"] },
    };
    const bad =
      "Behind him, Mr. Vale shifts his weight. Mrs. Blackwood remains still near the stairs.";
    expect(
      narrationPresenceViolations(bad, pack)
    ).toMatch(/Vale|Blackwood/);
    expect(
      performerSoftFailure(
        { narration: bad, dialogue: [], dressing: [] },
        pack
      )
    ).not.toBeNull();
  });

  it("allows narration with only present people", () => {
    const pack = {
      notPresentCharacters: [{ id: "vale", name: "Mr. Vale" }],
      location: { presentCharacterIds: ["henshaw"] },
    };
    const good =
      "Henshaw draws himself up, choosing his words with care. Rain ticks the glass.";
    expect(narrationPresenceViolations(good, pack)).toBeNull();
  });
});

describe("heuristicPerform (player-visible fallback)", () => {
  it("never leaks stage directions, engine notes, or raw input", async () => {
    const { heuristicPerform } = await import("./performer.js");
    const out = heuristicPerform({
      contextPack: {
        location: { name: "the entrance hall", description: "Marble floor." },
      },
      playerInput: "I formally accuse Mr. Vale",
      justHappened: [
        {
          id: "world_to_player",
          summary: "Vale shoves you back toward the stairs.",
          narrationHints:
            "WORLD→PLAYER (engine-applied AI effects): Applied effects: move_player. Stage these as real events. Do not invent further attacks.",
        },
      ],
      resolvedNotes: ["accuse formal", "evidence withheld"],
    });
    expect(out.narration).toContain("Vale shoves you back");
    expect(out.narration).toContain("Marble floor.");
    expect(out.narration).not.toContain("Applied effects");
    expect(out.narration).not.toContain("WORLD→PLAYER");
    expect(out.narration).not.toContain("Stage these");
    expect(out.narration).not.toContain("You act on");
    expect(out.narration).not.toContain("accuse formal");
  });
});
