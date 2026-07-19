import { describe, expect, it } from "vitest";
import {
  narrationPresenceViolations,
  performerSoftFailure,
} from "./performer.js";

describe("performerSoftFailure", () => {
  it("flags empty narration", () => {
    expect(performerSoftFailure({ narration: "", dialogue: [] })).not.toBeNull();
    expect(performerSoftFailure({ narration: "   ", dialogue: [] })).not.toBeNull();
    expect(performerSoftFailure({ narration: "Hi", dialogue: [] })).not.toBeNull();
  });

  it("accepts real narration", () => {
    expect(
      performerSoftFailure({
        narration: "You step into the hall. Rain ticks the glass.",
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
        { narration: bad, dialogue: [] },
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
