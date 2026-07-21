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
        "./__fixtures__/blackwood-fixture.json"
      ),
      "utf8"
    )
  )
);

describe("directorIntentsToPatch", () => {
  it("maps inspect vase to evidence grants (one per turn)", () => {
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
    // The vase yields the thread; the boot print now lives at its own
    // east-door inspectable (v0.9.9 spread the discoveries out).
    expect(applied.evidenceAdded).toEqual(["black-thread"]);

    const followUp = directorIntentsToPatch(
      def,
      applied.nextState,
      {
        intents: [{ type: "inspect", targetHint: "rainwater by the east door" }],
      },
      "Look closer at the rainwater by the east door"
    );
    const again = validateAndApplyPatch(def, applied.nextState, followUp.patch);
    expect(again.evidenceAdded).toEqual(["muddy-boot-print"]);
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
