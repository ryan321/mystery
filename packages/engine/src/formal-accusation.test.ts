import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import {
  beginFormalAccusation,
  clearFormalAccusationScene,
  isFormalAccusationSceneActive,
  resolveAccuseStaging,
} from "./formal-accusation.js";
import { applyAccuseGate } from "./accuse-gate.js";
import { buildPlayerView } from "./player-view.js";

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

describe("formal accusation ceremony", () => {
  it("opens a formal scene and gathers available cast", () => {
    const state = createInitialPlaythrough(def, "fa-1");
    const r = beginFormalAccusation(def, state);
    expect(r.rejected).toBeUndefined();
    expect(r.alreadyActive).toBe(false);
    expect(isFormalAccusationSceneActive(r.state)).toBe(true);
    expect(r.justHappened.some((j) => j.id === "formal_accusation_scene")).toBe(
      true
    );
    expect(buildPlayerView(def, r.state).formalAccusation.active).toBe(true);
    expect(buildPlayerView(def, r.state).formalAccusation.canBegin).toBe(false);
  });

  it("is idempotent when already active", () => {
    const state = createInitialPlaythrough(def, "fa-2");
    const once = beginFormalAccusation(def, state);
    const twice = beginFormalAccusation(def, once.state);
    expect(twice.alreadyActive).toBe(true);
    expect(twice.justHappened).toHaveLength(0);
  });

  it("treats accuse intent in the ceremony as formal (no pending)", () => {
    const base = createInitialPlaythrough(def, "fa-3");
    const staged = beginFormalAccusation(def, base).state;
    const gate = applyAccuseGate(
      def,
      staged,
      {
        accuse: {
          summary: "Vale killed Blackwood for the money",
          suspectIds: ["vale"],
          method: "push on the stairs",
          motive: "inheritance",
        },
      },
      "Vale killed him on the stairs for the inheritance."
    );
    expect(gate.notes.some((n) => n.includes("formal"))).toBe(true);
    expect(gate.patch.accuse?.suspectIds).toEqual(["vale"]);
    expect(gate.state.formalAccusationScene).toBeUndefined();
    expect(gate.state.pendingAccusation).toBeUndefined();
  });

  it("cancels the ceremony on withdraw without a theory", () => {
    const base = createInitialPlaythrough(def, "fa-4");
    const staged = beginFormalAccusation(def, base).state;
    const gate = applyAccuseGate(def, staged, {}, "never mind, not yet");
    expect(gate.notes).toContain("formal accusation scene cancelled");
    expect(isFormalAccusationSceneActive(gate.state)).toBe(false);
  });

  it("resolveAccuseStaging exposes win hint defaults", () => {
    const s = resolveAccuseStaging(def);
    expect(s.composerPlaceholder.toLowerCase()).toMatch(/accusation|who/);
    expect(s.winHint.toLowerCase()).toMatch(/who|how|why/);
  });

  it("clearFormalAccusationScene drops the flag", () => {
    const base = createInitialPlaythrough(def, "fa-5");
    const staged = beginFormalAccusation(def, base).state;
    const cleared = clearFormalAccusationScene(staged);
    expect(cleared.formalAccusationScene).toBeUndefined();
  });
});
