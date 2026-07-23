import { describe, expect, it } from "vitest";
import {
  filterDialogueToPresent,
  heuristicPerform,
  narrationPresenceViolations,
} from "./performer.js";

describe("filterDialogueToPresent", () => {
  it("keeps only speakers in the room", () => {
    const out = filterDialogueToPresent(
      {
        narration: "You look around.",
        dressing: [],
        dialogue: [
          { characterId: "henshaw", characterName: "Henshaw", text: "Sir." },
          { characterId: "vale", characterName: "Vale", text: "Ahem." },
        ],
      },
      { location: { presentCharacterIds: ["henshaw"] } }
    );
    expect(out.dialogue).toHaveLength(1);
    expect(out.dialogue[0]!.characterId).toBe("henshaw");
  });

  it("strips all dialogue in empty room", () => {
    const out = filterDialogueToPresent(
      {
        narration: "Quiet.",
        dressing: [],
        dialogue: [
          { characterId: "vale", characterName: "Vale", text: "Hello." },
        ],
      },
      { location: { presentCharacterIds: [] } }
    );
    expect(out.dialogue).toHaveLength(0);
  });
});

// Pack shaped like the prod turn-48 failure (2026-07-23): player in the
// library; Mrs. Blackwood and Clara in the conservatory; Hugo is the victim,
// his body in the entrance hall.
const libraryPack = {
  location: { id: "library" },
  notPresentCharacters: [
    {
      id: "mrs-blackwood",
      name: "Mrs. Blackwood",
      storyRole: "suspect",
      locationId: "conservatory",
      locationName: "Blackwood Manor — the conservatory",
    },
    {
      id: "clara",
      name: "Miss Clara Blackwood",
      storyRole: "suspect",
      locationId: "conservatory",
      locationName: "Blackwood Manor — the conservatory",
    },
    {
      id: "blackwood",
      name: "Mr. Hugo Blackwood",
      storyRole: "victim",
      locationId: "entrance-hall",
      locationName: "Blackwood Manor — the entrance hall",
    },
  ],
};

describe("narrationPresenceViolations", () => {
  it("allows mentions anchored to the character's own room (summon narration)", () => {
    const v = narrationPresenceViolations(
      "You head for the library. Mrs. Blackwood is in the conservatory with Miss Clara Blackwood; she will be sent for.",
      libraryPack
    );
    expect(v).toBeNull();
  });

  it("still flags absent people narrated as present here", () => {
    const v = narrationPresenceViolations(
      "Miss Clara Blackwood stands beside the desk, watching you.",
      libraryPack
    );
    expect(v).toContain("Miss Clara Blackwood");
  });

  it("allows describing the victim's body en route", () => {
    const v = narrationPresenceViolations(
      "You pass the sheet covering Mr. Hugo Blackwood on your way through.",
      libraryPack
    );
    expect(v).toBeNull();
  });

  it("flags the victim acting like a living person", () => {
    const v = narrationPresenceViolations(
      "Mr. Hugo Blackwood watches you from the doorway.",
      libraryPack
    );
    expect(v).toContain("Mr. Hugo Blackwood");
  });

  it("flags an elsewhere-mention when the room is not named in the sentence", () => {
    const v = narrationPresenceViolations(
      "Mrs. Blackwood remains near the window with you.",
      libraryPack
    );
    expect(v).toContain("Mrs. Blackwood");
  });
});

describe("heuristicPerform", () => {
  it("drops machine summaries and keeps diegetic ones", () => {
    const out = heuristicPerform({
      contextPack: {
        location: { name: "the library", description: "Cold and dark." },
      },
      playerInput: "go to the library",
      justHappened: [
        { id: "a", summary: "Mrs. Blackwood → Blackwood Manor — the library" },
        { id: "b", summary: "Player moved to Blackwood Manor — the library" },
        { id: "c", summary: "Traveled to Blackwood Manor — the library" },
        { id: "d", summary: "Wrap-up begins: First light" },
        { id: "e", summary: "Aftermath continues" },
        { id: "f", summary: "The investigation runs out of time" },
      ] as never,
    });
    expect(out.narration).toBe(
      "The investigation runs out of time. You are in the library. Cold and dark."
    );
  });

  it("caps summaries and always ends with the location", () => {
    const out = heuristicPerform({
      contextPack: {
        location: { name: "the study", description: "Papers everywhere." },
      },
      playerInput: "look",
      justHappened: [
        { id: "a", summary: "A scream echoes from upstairs" },
        { id: "b", summary: "The lights go out" },
        { id: "c", summary: "A door slams" },
      ] as never,
    });
    expect(out.narration).toBe(
      "A scream echoes from upstairs. The lights go out. You are in the study. Papers everywhere."
    );
  });
});
