import { describe, expect, it } from "vitest";
import { directorSoftFailure } from "./director.js";
import type { DirectorOutput } from "@mystery/shared";

describe("directorSoftFailure", () => {
  it("allows short inputs with empty other", () => {
    const out: DirectorOutput = {
      intents: [{ type: "other", note: "empty intents" }],
      physical: { kind: "none" },
      worldToPlayer: { active: false, effects: [] },
    };
    expect(directorSoftFailure(out, "ok")).toBeNull();
  });

  it("flags substantive input with only empty other", () => {
    const out: DirectorOutput = {
      intents: [{ type: "other", note: "empty intents" }],
      physical: { kind: "none" },
      worldToPlayer: { active: false, effects: [] },
    };
    expect(
      directorSoftFailure(out, "I examine the vase carefully")
    ).not.toBeNull();
  });

  it("allows real intents", () => {
    const out: DirectorOutput = {
      intents: [{ type: "inspect", inspectableId: "vase" }],
      physical: { kind: "none" },
      worldToPlayer: { active: false, effects: [] },
    };
    expect(
      directorSoftFailure(out, "I examine the vase carefully")
    ).toBeNull();
  });
});
