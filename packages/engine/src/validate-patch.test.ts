import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import { validateAndApplyPatch, scoreAccusation } from "./validate-patch.js";

const defPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../content/cases/blackwood-inheritance/definition.json"
);

const def = parseMysteryDefinition(
  JSON.parse(readFileSync(defPath, "utf8"))
);

describe("validateAndApplyPatch", () => {
  it("creates playthrough at entrance hall", () => {
    const state = createInitialPlaythrough(def, "test-1");
    expect(state.locationId).toBe("entrance-hall");
    expect(state.status).toBe("active");
  });

  it("allows move to library and rejects illegal teleport", () => {
    const state = createInitialPlaythrough(def, "test-2");
    const ok = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    });
    expect(ok.applied.setLocationId).toBe("library");
    expect(ok.nextState.locationId).toBe("library");

    const bad = validateAndApplyPatch(def, state, {
      setLocationId: "moon-base",
    });
    expect(bad.rejected.length).toBeGreaterThan(0);
    expect(bad.nextState.locationId).toBe("entrance-hall");
  });

  it("grants vase evidence only at entrance hall inspect path", () => {
    const state = createInitialPlaythrough(def, "test-3");
    const got = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["black-thread", "muddy-boot-print"],
      setFlags: { examined_vase: true, found_boot_print: true },
    });
    expect(got.evidenceAdded).toEqual(
      expect.arrayContaining(["black-thread", "muddy-boot-print"])
    );

    const inLibrary = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    });
    const bad = validateAndApplyPatch(def, inLibrary.nextState, {
      addEvidenceIds: ["black-thread"],
    });
    // already would fail if not held — thread only from hall
    expect(
      bad.rejected.some((r) => r.includes("black-thread")) ||
        bad.evidenceAdded.length === 0
    ).toBe(true);
  });

  it("requires brass key flag path for letter via drawer requires", () => {
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
    expect(state.flags.has_brass_key).toBe(true);

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
});
