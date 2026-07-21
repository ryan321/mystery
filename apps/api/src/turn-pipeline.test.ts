import { describe, expect, it } from "vitest";
import type { MysteryDefinition } from "@mystery/shared";
import { turnHardCap } from "./turn-pipeline.js";

const defWithBand = (maxTurns?: number) =>
  ({
    meta: { playtest: maxTurns === undefined ? undefined : { maxTurns } },
  }) as unknown as MysteryDefinition;

describe("turnHardCap", () => {
  it("defaults to 4x the assumed band when the case declares none", () => {
    expect(turnHardCap(defWithBand(undefined))).toBe(180);
  });

  it("never drops below the floor for short cases", () => {
    expect(turnHardCap(defWithBand(10))).toBe(150);
  });

  it("scales with the case's thorough-player band", () => {
    expect(turnHardCap(defWithBand(70))).toBe(280);
  });
});
