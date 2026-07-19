import { describe, expect, it } from "vitest";
import { directorSoftFailure } from "./director.js";
import type { DirectorOutput } from "@mystery/shared";

describe("directorSoftFailure", () => {
  it("allows short inputs with empty other", () => {
    const out: DirectorOutput = {
      intents: [{ type: "other", note: "empty intents" }],
    };
    expect(directorSoftFailure(out, "ok")).toBeNull();
  });

  it("flags substantive input with only empty other", () => {
    const out: DirectorOutput = {
      intents: [{ type: "other", note: "empty intents" }],
    };
    expect(
      directorSoftFailure(out, "I examine the vase carefully")
    ).not.toBeNull();
  });

  it("allows real intents", () => {
    const out: DirectorOutput = {
      intents: [{ type: "inspect", inspectableId: "vase" }],
    };
    expect(
      directorSoftFailure(out, "I examine the vase carefully")
    ).toBeNull();
  });
});
