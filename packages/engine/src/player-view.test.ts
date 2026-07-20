import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import { buildPlayerView } from "./player-view.js";
import { validateAndApplyPatch } from "./validate-patch.js";
import { applyEffects } from "./effects.js";
import { evaluateCondition } from "./conditions.js";
import { knownAsFor } from "./identity.js";
import { buildContextPack } from "./context-pack.js";

const rawJson = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../content/cases/blackwood-inheritance/definition.json"
  ),
  "utf8"
);
const def = parseMysteryDefinition(JSON.parse(rawJson));

/** Blackwood variant with fog seeds stripped — a stranger's empty map. */
function defWithNoKnownLocations() {
  const raw = JSON.parse(rawJson) as {
    locations: { knownAtStart?: boolean }[];
  };
  for (const l of raw.locations) delete l.knownAtStart;
  return parseMysteryDefinition(raw);
}

/** Blackwood variant: Henshaw's name is unknown at start ("The Butler"). */
function defWithUnknownButler() {
  const raw = JSON.parse(rawJson) as {
    characters: {
      id: string;
      introducedAs?: string;
      nameKnownAtStart?: boolean;
    }[];
  };
  const henshaw = raw.characters.find((c) => c.id === "henshaw")!;
  henshaw.introducedAs = "The Butler";
  henshaw.nameKnownAtStart = false;
  return parseMysteryDefinition(raw);
}

describe("buildPlayerView (UI-safe projection)", () => {
  it("never ships narrator-only or sealed content", () => {
    const state = createInitialPlaythrough(def, "pv-leak");
    const json = JSON.stringify(buildPlayerView(def, state)).toLowerCase();

    // Author hints for the narrator
    for (const loc of def.locations) {
      for (const insp of loc.inspectables) {
        const hint = insp.onInspect.narrativeHints;
        if (hint) expect(json).not.toContain(hint.toLowerCase().slice(0, 30));
      }
    }
    // Character internals
    for (const c of def.characters) {
      if (c.voice) expect(json).not.toContain(c.voice.toLowerCase().slice(0, 25));
      for (const d of c.defenses) {
        expect(json).not.toContain(d.toLowerCase().slice(0, 25));
      }
      for (const beat of [...c.knowledge.private, ...c.knowledge.secrets]) {
        expect(json).not.toContain(beat.content.toLowerCase().slice(0, 30));
      }
    }
    // Sealed truth + ending prose
    expect(json).not.toContain(def.solution.summary.toLowerCase().slice(0, 40));
    for (const e of def.endings) {
      expect(json).not.toContain(e.templateNotes.toLowerCase().slice(0, 30));
    }
    // Undiscovered evidence descriptions must not pre-leak
    for (const e of def.evidence) {
      expect(json).not.toContain(e.description.toLowerCase().slice(0, 25));
    }
  });

  it("honors knownAtStart: the briefed inspector's map starts oriented", () => {
    const state = createInitialPlaythrough(def, "pv-map-seed");
    const view = buildPlayerView(def, state);
    // Blackwood: Henshaw told the inspector where everyone is.
    expect(view.map.locations.map((l) => l.id).sort()).toEqual(
      ["conservatory", "entrance-hall", "guest-room", "library"].sort()
    );
    expect(
      view.map.locations.find((l) => l.id === "entrance-hall")?.visited
    ).toBe(true);
    expect(
      view.map.locations.find((l) => l.id === "library")?.visited
    ).toBe(false);
    // Edges come only from visited rooms — doors the player has seen.
    expect(view.map.connections.length).toBeGreaterThan(0);
    expect(view.map.connections.every((c) => c.from === "entrance-hall")).toBe(
      true
    );
    expect(view.map.connections.every((c) => c.destinationKnown)).toBe(true);
  });

  it("map is fog-of-war for a stranger: grows on visit and reveal", () => {
    const d = defWithNoKnownLocations();
    let state = createInitialPlaythrough(d, "pv-map");
    let view = buildPlayerView(d, state);
    expect(view.map.locations.map((l) => l.id)).toEqual(["entrance-hall"]);
    // Stranger's map: doors are visible but their destinations are unknown.
    expect(
      view.map.connections.every(
        (c) => c.from === "entrance-hall" && !c.destinationKnown
      )
    ).toBe(true);

    state = validateAndApplyPatch(d, state, {
      setLocationId: "library",
    }).nextState;
    view = buildPlayerView(d, state);
    expect(view.map.locations.map((l) => l.id).sort()).toEqual(
      ["entrance-hall", "library"].sort()
    );
    expect(
      view.map.locations.find((l) => l.id === "library")?.visited
    ).toBe(true);

    // Learn of a place without going there
    const unknown = d.locations.find(
      (l) => !["entrance-hall", "library"].includes(l.id)
    )!;
    const revealed = applyEffects(d, state, [
      { type: "reveal_location", locationId: unknown.id },
    ]);
    expect(
      evaluateCondition(d, revealed.state, {
        type: "location_known",
        locationId: unknown.id,
      } as never)
    ).toBe(true);
    view = buildPlayerView(d, revealed.state);
    const entry = view.map.locations.find((l) => l.id === unknown.id);
    expect(entry).toBeDefined();
    expect(entry?.visited).toBe(false);
  });

  it("scene lists exits, presence, and object names without requirements", () => {
    const state = createInitialPlaythrough(def, "pv-scene");
    const view = buildPlayerView(def, state);
    expect(view.scene.locationId).toBe("entrance-hall");
    expect(view.scene.exits.length).toBeGreaterThan(0);
    for (const o of view.scene.objects) {
      expect(Object.keys(o).sort()).toEqual(["id", "locked", "name"]);
    }
  });

  it("inventory shows held items only, without item flags", () => {
    let state = createInitialPlaythrough(def, "pv-inv");
    expect(buildPlayerView(def, state).inventory).toEqual([]);
    state = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    }).nextState;
    state = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["brass-key"],
    }).nextState;
    const inv = buildPlayerView(def, state).inventory;
    expect(inv.map((i) => i.id)).toEqual(["brass-key"]);
    expect(Object.keys(inv[0]!).sort()).toEqual([
      "condition",
      "description",
      "id",
      "name",
      "tags",
    ]);
  });

  it("ships the authored briefing as the opening package", () => {
    const state = createInitialPlaythrough(def, "pv-brief");
    const view = buildPlayerView(def, state);
    expect(view.openingPackage.form).toBe("dossier");
    expect(view.openingPackage.sections.length).toBeGreaterThan(0);
  });

  it("derives an opening package when no briefing is authored", () => {
    const raw = JSON.parse(rawJson) as { player: { briefing?: unknown } };
    delete raw.player.briefing;
    const d = parseMysteryDefinition(raw);
    const state = createInitialPlaythrough(d, "pv-brief-derived");
    const view = buildPlayerView(d, state);
    expect(view.openingPackage.form).toBe("custom");
    expect(view.openingPackage.sections.length).toBeGreaterThan(0);
  });
});

describe("character identity (knownAs)", () => {
  it("uses introducedAs until the name is revealed", () => {
    const d = defWithUnknownButler();
    let state = createInitialPlaythrough(d, "pv-id");

    expect(knownAsFor(d, state, "henshaw")).toBe("The Butler");
    expect(
      evaluateCondition(d, state, {
        type: "character_name_known",
        characterId: "henshaw",
      } as never)
    ).toBe(false);

    // UI: label everywhere, bio suppressed
    let view = buildPlayerView(d, state);
    const entry = view.cast.find((c) => c.id === "henshaw")!;
    expect(entry.knownAs).toBe("The Butler");
    expect(entry.nameKnown).toBe(false);
    expect(entry.bio).toBe("");

    // Narrator pack: cast/presence carry the label, not the real name.
    // (Authored prose may still name characters — a real label-only case is
    // written without the name throughout; that's an authoring rule.)
    const pack = buildContextPack(d, state);
    const castEntry = pack.cast.find((c) => c.id === "henshaw");
    expect(castEntry?.name).toBe("The Butler");
    expect(castEntry?.nameKnown).toBe(false);
    const present = pack.location.presentCharacters.find(
      (p) => p?.id === "henshaw"
    );
    expect(present?.name).toBe("The Butler");
    expect(present?.shortBio).toBe("");

    // Reveal
    const revealed = applyEffects(d, state, [
      { type: "reveal_character_name", characterId: "henshaw" },
    ]);
    state = revealed.state;
    expect(
      revealed.justHappened.some((j) => j.id === "name_revealed_henshaw")
    ).toBe(true);
    expect(knownAsFor(d, state, "henshaw")).toBe("Butler Henshaw");
    view = buildPlayerView(d, state);
    expect(view.cast.find((c) => c.id === "henshaw")?.nameKnown).toBe(true);
  });

  it("set_known_as updates the label without revealing the name", () => {
    const d = defWithUnknownButler();
    const state = createInitialPlaythrough(d, "pv-label");
    const r = applyEffects(d, state, [
      {
        type: "set_known_as",
        characterId: "henshaw",
        label: "the old butler",
      },
    ]);
    expect(knownAsFor(d, r.state, "henshaw")).toBe("the old butler");
    expect(
      evaluateCondition(d, r.state, {
        type: "character_name_known",
        characterId: "henshaw",
      } as never)
    ).toBe(false);
  });
});
