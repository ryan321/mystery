import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import { applyEffects } from "./effects.js";
import { validateAndApplyPatch } from "./validate-patch.js";

const def = parseMysteryDefinition(
  JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../content/cases/blackwood-inheritance/definition.json"
      ),
      "utf8"
    )
  )
);

describe("player impact effects", () => {
  it("harm_player escalates condition and emits justHappened", () => {
    const state = createInitialPlaythrough(def, "impact-harm");
    const r = applyEffects(def, state, [
      {
        type: "harm_player",
        condition: "bruised",
        text: "He shoves you into the banister.",
      },
    ]);
    expect(r.state.playerStatus.condition).toBe("bruised");
    expect(r.justHappened.some((j) => j.id === "player_harm_bruised")).toBe(
      true
    );
    expect(r.justHappened[0]?.narrationHints).toMatch(/shoves you/i);
  });

  it("condition does not de-escalate without force", () => {
    let state = createInitialPlaythrough(def, "impact-no-deesc");
    state = {
      ...state,
      playerStatus: {
        ...state.playerStatus,
        condition: "injured",
      },
    };
    const r = applyEffects(def, state, [
      { type: "set_player_condition", condition: "shaken" },
    ]);
    expect(r.state.playerStatus.condition).toBe("injured");
    expect(r.justHappened).toHaveLength(0);
  });

  it("steal_from_player removes preferred held item", () => {
    let state = createInitialPlaythrough(def, "impact-steal");
    state = {
      ...state,
      evidenceIds: ["vale-letter", "brass-key", "black-thread"],
      objectState: {
        ...state.objectState,
        "vale-letter": {
          stage: "taken",
          locked: false,
          holder: "player",
          condition: "intact",
          tags: [],
          flags: {},
          timesExamined: 0,
          timesUsed: 0,
        },
        "brass-key": {
          stage: "taken",
          locked: false,
          holder: "player",
          condition: "intact",
          tags: [],
          flags: {},
          timesExamined: 0,
          timesUsed: 0,
        },
        "black-thread": {
          stage: "taken",
          locked: false,
          holder: "player",
          condition: "intact",
          tags: [],
          flags: {},
          timesExamined: 0,
          timesUsed: 0,
        },
      },
    };
    const r = applyEffects(def, state, [
      {
        type: "steal_from_player",
        preferItemIds: ["brass-key", "black-thread"],
        exceptItemIds: ["vale-letter"],
        toLocationId: "guest-room",
        holder: "unknown",
        text: "The key is gone from your pocket.",
      },
    ]);
    expect(r.state.evidenceIds).not.toContain("brass-key");
    expect(r.state.evidenceIds).toContain("vale-letter");
    expect(r.state.evidenceIds).toContain("black-thread");
    expect(r.state.objectState["brass-key"]?.locationId).toBe("guest-room");
    expect(r.state.objectState["brass-key"]?.holder).toBe("unknown");
    expect(r.state.playerStatus.tags).toContain("robbed");
    expect(r.justHappened.some((j) => j.id === "stolen_brass-key")).toBe(true);
  });

  it("steal_from_player anyHeld skips except list", () => {
    let state = createInitialPlaythrough(def, "impact-anyheld");
    state = {
      ...state,
      evidenceIds: ["vale-letter"],
      objectState: {
        ...state.objectState,
        "vale-letter": {
          stage: "taken",
          locked: false,
          holder: "player",
          condition: "intact",
          tags: [],
          flags: {},
          timesExamined: 0,
          timesUsed: 0,
        },
      },
    };
    const r = applyEffects(def, state, [
      {
        type: "steal_from_player",
        anyHeld: true,
        exceptItemIds: ["vale-letter"],
        toLocationId: "library",
      },
    ]);
    expect(r.state.evidenceIds).toContain("vale-letter");
    expect(r.justHappened).toHaveLength(0);
  });

  it("set_item_condition on held item emits item_damaged", () => {
    let state = createInitialPlaythrough(def, "impact-damage");
    state = {
      ...state,
      evidenceIds: ["vale-letter"],
      objectState: {
        ...state.objectState,
        "vale-letter": {
          stage: "taken",
          locked: false,
          holder: "player",
          condition: "intact",
          tags: [],
          flags: {},
          timesExamined: 0,
          timesUsed: 0,
        },
      },
    };
    const r = applyEffects(def, state, [
      {
        type: "set_item_condition",
        itemId: "vale-letter",
        condition: "torn",
        text: "The letter tears in the struggle.",
      },
    ]);
    expect(r.state.objectState["vale-letter"]?.condition).toBe("torn");
    expect(r.justHappened.some((j) => j.id === "item_damaged_vale-letter")).toBe(
      true
    );
    expect(r.justHappened[0]?.summary).toMatch(/torn/i);
  });

  it("move_player relocates and narrates force", () => {
    const state = createInitialPlaythrough(def, "impact-move");
    const r = applyEffects(def, state, [
      {
        type: "move_player",
        toLocationId: "guest-room",
        text: "You are marched upstairs.",
      },
    ]);
    expect(r.state.locationId).toBe("guest-room");
    expect(r.justHappened[0]?.id).toBe("player_moved_guest-room");
    expect(r.justHappened[0]?.narrationHints).toMatch(/marched upstairs/i);
  });

  it("hold / knock_down / restrain / knock_out / release control states", () => {
    let state = createInitialPlaythrough(def, "impact-control");
    let r = applyEffects(def, state, [
      {
        type: "hold_player",
        byCharacterId: "vale",
        text: "Vale grips your arm.",
      },
    ]);
    expect(r.state.playerStatus.control).toBe("held");
    expect(r.state.playerStatus.controlledBy).toBe("vale");
    expect(r.justHappened.some((j) => j.id === "player_control_held")).toBe(
      true
    );

    r = applyEffects(def, r.state, [
      { type: "knock_down_player", byCharacterId: "vale" },
    ]);
    expect(r.state.playerStatus.control).toBe("downed");

    r = applyEffects(def, r.state, [{ type: "restrain_player" }]);
    expect(r.state.playerStatus.control).toBe("restrained");

    r = applyEffects(def, r.state, [{ type: "knock_out_player" }]);
    expect(r.state.playerStatus.control).toBe("unconscious");

    r = applyEffects(def, r.state, [
      { type: "release_player", text: "You come to free." },
    ]);
    expect(r.state.playerStatus.control).toBe("free");
    expect(r.state.playerStatus.controlledBy).toBeUndefined();
  });

  it("held player cannot voluntarily leave via patch", () => {
    let state = createInitialPlaythrough(def, "impact-block-move");
    state = {
      ...state,
      playerStatus: {
        ...state.playerStatus,
        control: "held",
        controlledBy: "vale",
      },
    };
    const got = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    });
    expect(got.applied.setLocationId).toBeUndefined();
    expect(got.rejected.some((r) => /held/i.test(r))).toBe(true);
    expect(got.nextState.locationId).toBe("entrance-hall");
  });
});
