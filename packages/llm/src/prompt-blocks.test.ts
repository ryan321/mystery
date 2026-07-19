import { describe, expect, it } from "vitest";
import {
  dynamicPromptPack,
  promptJson,
  staticCaseHeader,
} from "./prompt-blocks.js";

describe("dynamicPromptPack", () => {
  const fullPack = {
    caseMeta: { title: "T", tone: "grim", phase: "arrival", caseStatus: "active" },
    cast: [{ id: "vale", name: "Mr. Vale" }],
    location: { id: "hall", presentCharacters: [] },
    inventory: [],
    policy: {
      secondPerson: true,
      closedWorld: "static rule",
      noSolution: "static rule",
      denouement: "Investigation mode: solution sealed until judged.",
      accusations: "Only a formal, confirmed accusation decides the case.",
    },
  };

  it("strips the cast directory and static policy strings", () => {
    const dyn = dynamicPromptPack(fullPack) as Record<string, unknown>;
    expect(dyn.cast).toBeUndefined();
    expect(dyn.policy).toEqual({
      denouement: "Investigation mode: solution sealed until judged.",
      accusations: "Only a formal, confirmed accusation decides the case.",
    });
  });

  it("keeps everything volatile untouched", () => {
    const dyn = dynamicPromptPack(fullPack) as Record<string, unknown>;
    expect(dyn.location).toEqual(fullPack.location);
    expect(dyn.caseMeta).toEqual(fullPack.caseMeta);
    expect(dyn.inventory).toEqual(fullPack.inventory);
    // original pack is not mutated
    expect(fullPack.cast).toHaveLength(1);
    expect(Object.keys(fullPack.policy)).toContain("closedWorld");
  });

  it("passes through non-objects", () => {
    expect(dynamicPromptPack(null)).toBeNull();
    expect(dynamicPromptPack("x")).toBe("x");
  });
});

describe("prompt layout helpers", () => {
  it("staticCaseHeader is deterministic for the same input", () => {
    const a = staticCaseHeader('{"x":1}');
    const b = staticCaseHeader('{"x":1}');
    expect(a).toBe(b);
    expect(a.startsWith("## Case reference")).toBe(true);
  });

  it("promptJson is compact", () => {
    expect(promptJson({ a: 1, b: [1, 2] })).toBe('{"a":1,"b":[1,2]}');
  });
});
