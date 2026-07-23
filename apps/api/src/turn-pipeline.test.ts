import { describe, expect, it } from "vitest";
import type { MysteryDefinition } from "@mystery/shared";
import { turnHardCap } from "./turn-pipeline.js";

const defWithBand = (maxTurns?: number) =>
  ({
    meta: { playtest: maxTurns === undefined ? undefined : { maxTurns } },
  }) as unknown as MysteryDefinition;

describe("turnHardCap", () => {
  it("floors at 500 when 4x the band is lower", () => {
    expect(turnHardCap(defWithBand(undefined))).toBe(500); // 45*4=180 → 500
    expect(turnHardCap(defWithBand(10))).toBe(500); // 40 → 500
    expect(turnHardCap(defWithBand(70))).toBe(500); // 280 → 500
  });

  it("scales past the floor for a long authored band", () => {
    expect(turnHardCap(defWithBand(150))).toBe(600); // 150*4
  });
});
