import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import { evaluateBeats } from "./beats.js";
import { evaluateCondition } from "./conditions.js";
import { buildContextPack } from "./context-pack.js";
import { buildPlayerView } from "./player-view.js";
import { staticCasePackJson } from "./static-pack.js";
import { characterKnown, revealCoPresentCharacters } from "./identity.js";
import { applyEffects } from "./effects.js";

const rawJson = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "./__fixtures__/blackwood-fixture.json"
  ),
  "utf8"
);

/** Blackwood + two hidden characters: an arriving constable and a
 *  mention-only groundskeeper. */
function defWithHiddenCharacters() {
  const raw = JSON.parse(rawJson) as {
    characters: Record<string, unknown>[];
  };
  raw.characters.push(
    {
      id: "constable-reed",
      name: "Constable Reed",
      shortBio: "A rain-soaked county constable.",
      storyRole: "support",
      knownAtStart: false,
      entrance: {
        when: { type: "game_flag", id: "storm_breaks", equals: true },
        mode: "appear",
        atLocationId: "entrance-hall",
        announce:
          "A hammering at the storm door: a constable, soaked to the bone, has fought his way up the road.",
      },
      knowledge: { public: "The road washed out an hour after dark." },
    },
    {
      id: "groundskeeper",
      name: "Old Tom Barrow",
      introducedAs: "the groundskeeper",
      nameKnownAtStart: false,
      knownAtStart: false,
      defaultLocationId: "conservatory",
      entrance: {
        when: { type: "game_flag", id: "asked_about_grounds", equals: true },
        mode: "mention",
        announce:
          "Henshaw mentions a groundskeeper who keeps to the outbuildings.",
      },
      knowledge: { public: "" },
    }
  );
  return parseMysteryDefinition(raw);
}

describe("hidden characters (existence fog)", () => {
  const def = defWithHiddenCharacters();

  it("are absent from the static case block", () => {
    const json = staticCasePackJson(def);
    expect(json).not.toContain("constable-reed");
    expect(json).not.toContain("Constable Reed");
    expect(json).not.toContain("groundskeeper");
  });

  it("start unknown, offstage, and absent from every list", () => {
    const state = createInitialPlaythrough(def, "hc-init");
    expect(state.playerKnowledge["constable-reed"]?.known).toBe(false);
    // appear-entrance sugar: offstage until the entrance fires
    expect(state.characterState["constable-reed"]?.available).toBe(false);

    const pack = buildContextPack(def, state);
    expect(pack.cast.some((c) => c.id === "constable-reed")).toBe(false);
    expect(
      pack.notPresentCharacters.some((c) => c.id === "constable-reed")
    ).toBe(false);
    expect(pack.newlyKnownCast).toEqual([]);

    const view = buildPlayerView(def, state);
    expect(view.cast.some((c) => c.id === "constable-reed")).toBe(false);
    expect(view.cast.some((c) => c.id === "groundskeeper")).toBe(false);
  });

  it("ENTRANCE (appear): condition fires → known, present, in every list", () => {
    let state = createInitialPlaythrough(def, "hc-appear");
    state = { ...state, flags: { ...state.flags, storm_breaks: true } };

    const r = evaluateBeats(def, state, 3);
    expect(r.fired).toContain("character_entrance_constable-reed");
    expect(
      r.justHappened.some((j) => j.id === "character_entrance_constable-reed")
    ).toBe(true);
    expect(
      r.justHappened.some((j) =>
        (j.narrationHints ?? "").includes("hammering at the storm door")
      )
    ).toBe(true);

    state = r.state;
    expect(characterKnown(def, state, "constable-reed")).toBe(true);
    expect(state.characterState["constable-reed"]?.available).toBe(true);
    expect(state.characterState["constable-reed"]?.locationId).toBe(
      "entrance-hall"
    );

    const pack = buildContextPack(def, state);
    expect(pack.cast.some((c) => c.id === "constable-reed")).toBe(true);
    expect(pack.newlyKnownCast.some((c) => c.id === "constable-reed")).toBe(
      true
    );
    const view = buildPlayerView(def, state);
    expect(view.cast.some((c) => c.id === "constable-reed")).toBe(true);
    // player is in the entrance hall: the constable is in the presence strip
    expect(view.scene.present.some((p) => p.id === "constable-reed")).toBe(
      true
    );
    // fires once
    expect(evaluateBeats(def, state, 3).fired).toEqual([]);
  });

  it("ENTRANCE (mention): becomes known and listed, but not present", () => {
    let state = createInitialPlaythrough(def, "hc-mention");
    state = { ...state, flags: { ...state.flags, asked_about_grounds: true } };
    const r = evaluateBeats(def, state, 3);
    expect(r.fired).toContain("character_entrance_groundskeeper");
    state = r.state;

    expect(characterKnown(def, state, "groundskeeper")).toBe(true);
    const view = buildPlayerView(def, state);
    const entry = view.cast.find((c) => c.id === "groundskeeper");
    expect(entry).toBeDefined();
    // identity fog still applies: known to exist, name not yet learned
    expect(entry?.knownAs).toBe("the groundskeeper");
    expect(entry?.nameKnown).toBe(false);
    expect(view.scene.present.some((p) => p.id === "groundskeeper")).toBe(
      false
    );
  });

  it("meeting someone reveals them (co-presence)", () => {
    let state = createInitialPlaythrough(def, "hc-meet");
    // walk into the conservatory where the (unmentioned) groundskeeper works
    state = { ...state, locationId: "conservatory" };
    expect(characterKnown(def, state, "groundskeeper")).toBe(false);
    const r = revealCoPresentCharacters(def, state);
    expect(r.revealedIds).toContain("groundskeeper");
    expect(characterKnown(def, r.state, "groundskeeper")).toBe(true);
  });

  it("reveal_character effect + character_known condition", () => {
    const state = createInitialPlaythrough(def, "hc-effect");
    expect(
      evaluateCondition(def, state, {
        type: "character_known",
        characterId: "constable-reed",
      } as never)
    ).toBe(false);
    const r = applyEffects(def, state, [
      { type: "reveal_character", characterId: "constable-reed" },
    ]);
    expect(
      r.justHappened.some((j) => j.id === "character_revealed_constable-reed")
    ).toBe(true);
    expect(
      evaluateCondition(def, r.state, {
        type: "character_known",
        characterId: "constable-reed",
      } as never)
    ).toBe(true);
    // reveal ≠ arrival: still offstage
    expect(r.state.characterState["constable-reed"]?.available).toBe(false);
  });

  it("rejects an appear entrance without a valid location", () => {
    const raw = JSON.parse(rawJson) as { characters: Record<string, unknown>[] };
    raw.characters.push({
      id: "ghost",
      name: "Ghost",
      knownAtStart: false,
      entrance: { when: { type: "always" }, mode: "appear" },
      knowledge: { public: "" },
    });
    expect(() => parseMysteryDefinition(raw)).toThrow(/requires atLocationId/);
  });
});
