import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import {
  DRESSING_LIMITS,
  applyDressing,
  dressingLines,
  slugifySubject,
} from "./dressing.js";
import { buildContextPack } from "./context-pack.js";

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

const chandelier = {
  scope: "location" as const,
  id: "entrance-hall",
  subject: "chandelier",
  detail: "a crystal chandelier hangs over the stairwell",
};

describe("applyDressing", () => {
  it("persists a location detail and replays it in the next pack", () => {
    const state = createInitialPlaythrough(def, "dr-1");
    const r = applyDressing(def, state, [chandelier]);
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected).toEqual([]);

    const pack = buildContextPack(def, r.state);
    expect(pack.location.establishedDetails).toEqual([
      "chandelier: a crystal chandelier hangs over the stairwell",
    ]);
  });

  it("THE CHANDELIER TEST: later facts join the same subject thread cumulatively", () => {
    const state = createInitialPlaythrough(def, "dr-thread");
    const turn1 = applyDressing(def, state, [chandelier]);
    // turn 20: the player inspects it; the performer adds detail
    const turn20 = applyDressing(def, { ...turn1.state, turnCount: 20 }, [
      {
        scope: "location",
        id: "entrance-hall",
        subject: "chandelier",
        detail: "easily five hundred pieces of cut crystal, a few cloudy with age",
      },
    ]);
    const pack = buildContextPack(def, turn20.state);
    expect(pack.location.establishedDetails).toEqual([
      "chandelier: a crystal chandelier hangs over the stairwell; easily five hundred pieces of cut crystal, a few cloudy with age",
    ]);
  });

  it("facts are append-only and deduped", () => {
    const state = createInitialPlaythrough(def, "dr-dupe");
    const once = applyDressing(def, state, [chandelier]);
    const twice = applyDressing(def, once.state, [
      { ...chandelier, detail: "A crystal chandelier HANGS over the stairwell  " },
    ]);
    expect(twice.accepted).toHaveLength(0);
    expect(
      twice.state.locationState["entrance-hall"]?.dressing
    ).toHaveLength(1);
  });

  it("caps facts per subject", () => {
    let state = createInitialPlaythrough(def, "dr-cap");
    for (let i = 0; i < DRESSING_LIMITS.factsPerSubject; i++) {
      state = applyDressing(def, state, [
        { ...chandelier, detail: `fact number ${i}` },
      ]).state;
    }
    const over = applyDressing(def, state, [
      { ...chandelier, detail: "one fact too many" },
    ]);
    expect(over.accepted).toHaveLength(0);
    expect(over.rejected[0]).toContain("subject full");
  });

  it("caps proposals per turn", () => {
    const state = createInitialPlaythrough(def, "dr-turncap");
    const proposals = Array.from({ length: DRESSING_LIMITS.perTurn + 2 }, (_, i) => ({
      scope: "location" as const,
      id: "entrance-hall",
      subject: `thing-${i}`,
      detail: `detail ${i}`,
    }));
    const r = applyDressing(def, state, proposals);
    expect(r.accepted).toHaveLength(DRESSING_LIMITS.perTurn);
    expect(r.rejected).toHaveLength(2);
  });

  it("rejects unknown ids (closed world) and over-length details", () => {
    const state = createInitialPlaythrough(def, "dr-closed");
    const r = applyDressing(def, state, [
      { scope: "location", id: "secret-lab", detail: "gleaming vats" },
      { scope: "character", id: "nobody", detail: "a scar" },
      {
        scope: "location",
        id: "entrance-hall",
        subject: "rug",
        detail: "x".repeat(DRESSING_LIMITS.detailChars + 1),
      },
    ]);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected).toHaveLength(3);
  });

  it("dresses characters and held items into their pack slices", () => {
    let state = createInitialPlaythrough(def, "dr-char");
    state = applyDressing(def, state, [
      {
        scope: "character",
        id: "henshaw",
        subject: "hands",
        detail: "white gloves, immaculate except one frayed seam",
      },
      {
        scope: "item",
        id: "brass-key",
        subject: "engraving",
        detail: "a tiny letter B stamped on the bow",
      },
    ]).state;

    const pack = buildContextPack(def, state);
    const henshaw = pack.charactersHereDetailed.find(
      (c) => c && c.id === "henshaw"
    );
    expect(henshaw?.establishedDetails).toEqual([
      "hands: white gloves, immaculate except one frayed seam",
    ]);
    // brass key not held yet → item dressing persists on object state
    expect(state.objectState["brass-key"]?.dressing).toHaveLength(1);
  });

  it("slugifies subjects and defaults to 'scene'", () => {
    expect(slugifySubject("The Chandelier!")).toBe("the-chandelier");
    expect(slugifySubject(undefined)).toBe("scene");
    expect(slugifySubject("  ")).toBe("scene");
  });

  it("dressingLines groups by subject in turn order", () => {
    expect(
      dressingLines([
        { subject: "rug", detail: "worn persian rug", turn: 3 },
        { subject: "chandelier", detail: "five hundred crystals", turn: 20 },
        { subject: "chandelier", detail: "hangs over the stairwell", turn: 1 },
      ])
    ).toEqual([
      "rug: worn persian rug",
      "chandelier: hangs over the stairwell; five hundred crystals",
    ]);
  });
});
