import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import { directorIntentsToPatch } from "./intents-to-patch.js";
import { validateAndApplyPatch } from "./validate-patch.js";

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

describe("directorIntentsToPatch", () => {
  it("maps inspect vase to evidence grants", () => {
    const state = createInitialPlaythrough(def, "t1");
    const { patch } = directorIntentsToPatch(
      def,
      state,
      {
        intents: [{ type: "inspect", targetHint: "broken vase" }],
      },
      "Examine the broken vase"
    );
    const applied = validateAndApplyPatch(def, state, patch);
    expect(applied.evidenceAdded).toEqual(
      expect.arrayContaining(["black-thread", "muddy-boot-print"])
    );
  });

  it("maps move to library", () => {
    const state = createInitialPlaythrough(def, "t2");
    const { patch } = directorIntentsToPatch(
      def,
      state,
      {
        intents: [{ type: "move", exitHint: "library" }],
      },
      "go to the library"
    );
    const applied = validateAndApplyPatch(def, state, patch);
    expect(applied.nextState.locationId).toBe("library");
  });
});
