import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import { computeMysteryProgress } from "./progress.js";

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

describe("computeMysteryProgress", () => {
  it("starts at surface with no pulses", () => {
    const state = createInitialPlaythrough(def, "prog-1");
    const p = computeMysteryProgress(def, state);
    expect(p.depth).toBe("surface");
    expect(p.pulses).toHaveLength(0);
    expect(p.fraction).toBeLessThan(0.3);
    expect(p.throughLabel.toLowerCase()).toMatch(/begin|third|half/);
    expect(p.throughCompact).toBeTruthy();
    // Investigation is a sibling of structural progress (empty graph → empty leads).
    expect(p.investigation).toBeDefined();
    expect(p.investigation.leads).toEqual([]);
  });

  it("deepens with evidence and emits pulse", () => {
    const prev = createInitialPlaythrough(def, "prog-2b");
    let state = createInitialPlaythrough(def, "prog-2");
    state = {
      ...state,
      evidenceIds: ["black-thread"],
      phaseId: "deepening",
    };
    const p = computeMysteryProgress(def, state, {
      previous: prev,
      evidenceAdded: ["black-thread"],
    });
    expect(["deepening", "closing"]).toContain(p.depth);
    expect(p.pulses.some((x) => x.kind === "evidence")).toBe(true);
  });

  it("judgment when pending accusation", () => {
    let state = createInitialPlaythrough(def, "prog-3");
    state = {
      ...state,
      pendingAccusation: {
        summary: "Vale did it",
        suspectIds: ["vale"],
        missing: ["method", "motive"],
        madeOnTurn: 1,
        expiresAfterTurn: 10,
      },
    };
    const p = computeMysteryProgress(def, state);
    expect(p.depth).toBe("judgment");
  });
});
