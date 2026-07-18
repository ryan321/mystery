import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseMysteryDefinition } from "./definition.js";

const casesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../content/cases"
);
const root = join(casesDir, "blackwood-inheritance/definition.json");
const schemaPath = join(casesDir, "definition.schema.json");

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

  it("ships a generated JSON Schema for editors", () => {
    expect(existsSync(schemaPath)).toBe(true);
    const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
    expect(schema.$schema).toMatch(/json-schema/i);
    expect(schema.title).toBe("Mystery Case Definition");
    expect(schema.properties?.schemaVersion).toBeTruthy();
    expect(schema.properties?.locations).toBeTruthy();
    expect(schema.properties?.beats).toBeTruthy();
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "schemaVersion",
        "id",
        "meta",
        "player",
        "locations",
        "solution",
        "endings",
      ])
    );
  });
});
