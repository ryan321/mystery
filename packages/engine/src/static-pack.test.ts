import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { buildStaticCasePack, staticCasePackJson } from "./static-pack.js";

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

describe("staticCasePackJson (prompt-cache prefix)", () => {
  it("is byte-identical across calls (memoized)", () => {
    const a = staticCasePackJson(def);
    const b = staticCasePackJson(def);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(200);
  });

  it("contains the stable case reference", () => {
    const pack = buildStaticCasePack(def);
    expect(pack.caseMeta.title).toBe(def.meta.title);
    expect(pack.cast.map((c) => c.id)).toContain("vale");
    expect(pack.locations.map((l) => l.id)).toContain("entrance-hall");
    expect(pack.policy.noSolution).toBeTruthy();
  });

  it("never leaks sealed or gated content", () => {
    const json = staticCasePackJson(def).toLowerCase();

    // Solution / canon
    expect(json).not.toContain(def.solution.summary.toLowerCase().slice(0, 40));
    if (def.solution.method) {
      expect(json).not.toContain(def.solution.method.toLowerCase().slice(0, 25));
    }
    expect(json).not.toContain('"guiltypartyids"');

    // Knowledge beat contents
    for (const c of def.characters) {
      for (const beat of [...c.knowledge.private, ...c.knowledge.secrets]) {
        expect(json).not.toContain(beat.content.toLowerCase().slice(0, 30));
      }
    }

    // Evidence catalog (names/descriptions would pre-spoil discoveries)
    for (const e of def.evidence) {
      expect(json).not.toContain(e.description.toLowerCase().slice(0, 25));
    }

    // Ending prose
    for (const e of def.endings) {
      expect(json).not.toContain(e.templateNotes.toLowerCase().slice(0, 30));
    }

    // Beat hints (plot graph is sealed)
    for (const b of def.beats) {
      if (b.narrationHints) {
        expect(json).not.toContain(b.narrationHints.toLowerCase().slice(0, 30));
      }
    }
  });
});
