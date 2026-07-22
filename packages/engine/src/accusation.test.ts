import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseMysteryDefinition,
  type AccusationExtraction,
} from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import { scoreAccusationDetailed } from "./accusation.js";

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

// Fixture rubric: guilty ["vale"]; facts killer-vale (identity),
// motive-exposure (motive), method-hall (method); policy identity_plus_one.
const accuse = {
  summary: "Mr. Vale killed the master.",
  method: "He came in by the east door after eleven.",
  motive: "The letter would have exposed him.",
  suspectIds: [] as string[],
};

function extraction(
  namedCulpritIds: string[],
  statuses: Record<string, "affirmed" | "denied" | "unmentioned">
): AccusationExtraction {
  return {
    namedCulpritIds,
    facts: def.solution.rubric.requiredFacts.map((f) => ({
      factId: f.id,
      status: statuses[f.id] ?? "unmentioned",
    })),
  };
}

describe("scoreAccusationDetailed with LLM extraction", () => {
  it("full truth extracted → success", () => {
    const state = createInitialPlaythrough(def, "acc-1");
    const result = scoreAccusationDetailed(
      def,
      state,
      accuse,
      extraction(["vale"], {
        "killer-vale": "affirmed",
        "motive-exposure": "affirmed",
        "method-hall": "affirmed",
      })
    );
    expect(result.score).toBe("success");
    expect(result.identityCorrect).toBe(true);
    expect(result.hitFactIds).toHaveLength(3);
  });

  it("identity + one supporting fact satisfies identity_plus_one", () => {
    const state = createInitialPlaythrough(def, "acc-2");
    const result = scoreAccusationDetailed(
      def,
      state,
      accuse,
      extraction(["vale"], {
        "killer-vale": "affirmed",
        "motive-exposure": "affirmed",
        "method-hall": "unmentioned",
      })
    );
    expect(result.score).toBe("success");
    expect(result.supportingHits).toBe(1);
  });

  it("a denied fact is no hit — paraphrase-proof negation handling", () => {
    const state = createInitialPlaythrough(def, "acc-3");
    const result = scoreAccusationDetailed(
      def,
      state,
      accuse,
      extraction(["vale"], {
        "killer-vale": "affirmed",
        "motive-exposure": "denied",
        "method-hall": "denied",
      })
    );
    // Identity correct but zero supporting hits → partial, not success.
    expect(result.score).toBe("partial");
    expect(result.identityCorrect).toBe(true);
    expect(result.supportingHits).toBe(0);
  });

  it("naming nobody → no identity, partial credit for affirmed facts", () => {
    const state = createInitialPlaythrough(def, "acc-4");
    const result = scoreAccusationDetailed(
      def,
      state,
      accuse,
      extraction([], {
        "killer-vale": "unmentioned",
        "motive-exposure": "affirmed",
        "method-hall": "affirmed",
      })
    );
    expect(result.score).toBe("partial");
    expect(result.identityCorrect).toBe(false);
  });

  it("structured suspectIds still establish identity without extraction naming", () => {
    const state = createInitialPlaythrough(def, "acc-5");
    const result = scoreAccusationDetailed(
      def,
      state,
      { ...accuse, suspectIds: ["vale"] },
      extraction([], {
        "killer-vale": "unmentioned",
        "motive-exposure": "affirmed",
      })
    );
    expect(result.score).toBe("success");
    expect(result.identityCorrect).toBe(true);
  });

  it("legacy regex path is unchanged when extraction is absent", () => {
    const state = createInitialPlaythrough(def, "acc-6");
    const result = scoreAccusationDetailed(def, state, {
      summary: "Vale did it for the money.",
      method: "",
      motive: "",
      suspectIds: [],
    });
    // "vale" (identity) + "money" (motive hint) → identity_plus_one success.
    expect(result.score).toBe("success");

    const negated = scoreAccusationDetailed(def, state, {
      summary: "It wasn't Vale — Henshaw is innocent too, but someone did it.",
      method: "",
      motive: "",
      suspectIds: [],
    });
    expect(negated.identityCorrect).toBe(false);
    expect(negated.score).toBe("failure");
  });
});
