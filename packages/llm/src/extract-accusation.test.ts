import { describe, expect, it } from "vitest";
import { normalizeExtraction } from "./extract-accusation.js";

const known = {
  characterIds: new Set(["vale", "henshaw"]),
  factIds: new Set(["killer-vale", "motive-exposure"]),
};

describe("normalizeExtraction", () => {
  it("accepts a well-formed reply", () => {
    const n = normalizeExtraction(
      {
        namedCulpritIds: ["vale"],
        facts: [
          { factId: "killer-vale", status: "affirmed" },
          { factId: "motive-exposure", status: "denied" },
        ],
      },
      known
    );
    expect(n).toEqual({
      namedCulpritIds: ["vale"],
      facts: [
        { factId: "killer-vale", status: "affirmed" },
        { factId: "motive-exposure", status: "denied" },
      ],
    });
  });

  it("drops hallucinated ids instead of corrupting the verdict", () => {
    const n = normalizeExtraction(
      {
        namedCulpritIds: ["vale", "santa-claus"],
        facts: [
          { factId: "killer-vale", status: "affirmed" },
          { factId: "invented-fact", status: "affirmed" },
        ],
      },
      known
    );
    expect(n?.namedCulpritIds).toEqual(["vale"]);
    expect(n?.facts).toEqual([{ factId: "killer-vale", status: "affirmed" }]);
  });

  it("rejects invalid shapes", () => {
    expect(normalizeExtraction("nope", known)).toBeNull();
    expect(normalizeExtraction({ facts: "affirmed" }, known)).toBeNull();
    expect(
      normalizeExtraction(
        { namedCulpritIds: ["vale"], facts: [{ factId: "killer-vale", status: "maybe" }] },
        known
      )
    ).toBeNull();
  });

  it("defaults missing arrays to empty", () => {
    const n = normalizeExtraction({}, known);
    expect(n).toEqual({ namedCulpritIds: [], facts: [] });
  });
});
