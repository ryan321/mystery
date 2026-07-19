import { describe, expect, it } from "vitest";
import { filterDialogueToPresent } from "./performer.js";

describe("filterDialogueToPresent", () => {
  it("keeps only speakers in the room", () => {
    const out = filterDialogueToPresent(
      {
        narration: "You look around.",
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
        dialogue: [
          { characterId: "vale", characterName: "Vale", text: "Hello." },
        ],
      },
      { location: { presentCharacterIds: [] } }
    );
    expect(out.dialogue).toHaveLength(0);
  });
});
