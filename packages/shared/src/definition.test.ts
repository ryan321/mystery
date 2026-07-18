import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseMysteryDefinition } from "./definition.js";

const root = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../content/cases/blackwood-inheritance/definition.json"
);

describe("MysteryDefinitionSchema", () => {
  it("parses the Blackwood Inheritance content fixture", () => {
    const raw = JSON.parse(readFileSync(root, "utf8"));
    const def = parseMysteryDefinition(raw);
    expect(def.id).toBe("blackwood-inheritance");
    expect(def.locations.length).toBeGreaterThanOrEqual(2);
    expect(def.player.startingLocationId).toBe("entrance-hall");
  });

  it("rejects unknown starting location", () => {
    const raw = JSON.parse(readFileSync(root, "utf8"));
    raw.player.startingLocationId = "nowhere";
    expect(() => parseMysteryDefinition(raw)).toThrow();
  });
});
