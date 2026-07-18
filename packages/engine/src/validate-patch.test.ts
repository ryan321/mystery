import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import { validateAndApplyPatch, scoreAccusation } from "./validate-patch.js";
import { evaluateBeats, advancePassiveTime } from "./beats.js";
import { directorIntentsToPatch } from "./intents-to-patch.js";

const def = parseMysteryDefinition(
  JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../content/cases/blackwood-inheritance/definition.json"
      ),
      "utf8"
    )
  )
);

describe("validateAndApplyPatch", () => {
  it("creates playthrough at entrance hall with entity state", () => {
    const state = createInitialPlaythrough(def, "test-1");
    expect(state.locationId).toBe("entrance-hall");
    expect(state.characterState.henshaw?.willingness).toBe("open");
    expect(state.environment.weather).toBe("storm");
    expect(state.time?.slotId).toBe("just_after_eleven");
  });

  it("allows move to library", () => {
    const state = createInitialPlaythrough(def, "test-2");
    const ok = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    });
    expect(ok.nextState.locationId).toBe("library");
  });

  it("grants vase evidence", () => {
    const state = createInitialPlaythrough(def, "test-3");
    const got = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["black-thread", "muddy-boot-print"],
      setFlags: { examined_vase: true, found_boot_print: true },
    });
    expect(got.evidenceAdded).toEqual(
      expect.arrayContaining(["black-thread", "muddy-boot-print"])
    );
  });

  it("requires brass-key evidence for letter (not magic flag)", () => {
    let state = createInitialPlaythrough(def, "test-4");
    state = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    }).nextState;

    const withoutKey = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["vale-letter"],
    });
    expect(withoutKey.evidenceAdded).not.toContain("vale-letter");

    state = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["brass-key"],
    }).nextState;
    expect(state.evidenceIds).toContain("brass-key");

    const withKey = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["vale-letter"],
      setFlags: { found_vale_letter: true },
    });
    expect(withKey.evidenceAdded).toContain("vale-letter");
  });

  it("scores accusation for Vale success", () => {
    const score = scoreAccusation(def, {
      summary:
        "Vale killed him in the hall during a struggle over the letter; fraud exposure motive; vase crashed on the stairs.",
      suspectIds: ["vale"],
    });
    expect(score).toBe("success");
  });

  it("fires letter beat chain: phase, time, clara moves, henshaw knowledge", () => {
    let state = createInitialPlaythrough(def, "test-beats");
    state = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    }).nextState;
    state = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["brass-key"],
    }).nextState;
    state = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["vale-letter"],
      setFlags: { found_vale_letter: true },
    }).nextState;

    const beats = evaluateBeats(def, state, 3);
    expect(beats.fired).toContain("letter_unlocks_deepening");
    expect(beats.state.phaseId).toBe("deepening");
    expect(beats.state.time?.slotId).toBe("late_evening");
    expect(beats.state.characterState.clara?.locationId).toBe("entrance-hall");
    expect(
      beats.state.characterMemory.henshaw?.revealedBeatIds
    ).toContain("henshaw-saw-vale-earlier");
  });

  it("presenting letter to vale fires cornered beat", () => {
    let state = createInitialPlaythrough(def, "test-present");
    state = {
      ...state,
      evidenceIds: ["vale-letter"],
      flags: { ...state.flags, found_vale_letter: true },
    };
    state = validateAndApplyPatch(def, state, {
      presented: [{ evidenceId: "vale-letter", characterId: "vale" }],
      talkToCharacterId: "vale",
    }).nextState;

    const beats = evaluateBeats(def, state, 3);
    expect(beats.fired).toContain("vale_cornered_by_letter");
    expect(beats.state.characterState.vale?.alibiStatus).toBe("broken");
    expect(beats.state.characterState.vale?.willingness).toBe("hostile");
  });

  it("passive time can reach midnight beat", () => {
    let state = createInitialPlaythrough(def, "test-time");
    // jump near midnight
    state = {
      ...state,
      time: {
        slotId: "approaching_midnight",
        minutesFromStart: 115,
        reachedSlotIdsThisTurn: [],
      },
      turnCount: 5,
    };
    state = advancePassiveTime(def, state);
    // one more march over 120
    state = {
      ...state,
      time: {
        ...state.time!,
        minutesFromStart: 125,
        reachedSlotIdsThisTurn: ["midnight"],
        slotId: "midnight",
      },
    };
    const beats = evaluateBeats(def, state, 2);
    expect(beats.fired).toContain("midnight_strikes");
    expect(beats.state.environment.light).toBe("night");
  });

  it("director inspect maps to patch", () => {
    const state = createInitialPlaythrough(def, "t1");
    const { patch } = directorIntentsToPatch(
      def,
      state,
      { intents: [{ type: "inspect", targetHint: "broken vase" }] },
      "Examine the broken vase"
    );
    const applied = validateAndApplyPatch(def, state, patch);
    expect(applied.evidenceAdded.length).toBeGreaterThan(0);
  });
});
