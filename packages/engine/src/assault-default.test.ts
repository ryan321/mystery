import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import {
  applyDefaultAssaultConsequences,
  applyDefaultMisconductConsequences,
  assaultCaseHandled,
} from "./assault-default.js";
import {
  directorIntentsToPatch,
  inputLooksLikeMisconduct,
} from "./intents-to-patch.js";

const blackwood = parseMysteryDefinition(
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

const whiteRoom = parseMysteryDefinition(
  JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../content/cases/the-white-room/definition.json"
      ),
      "utf8"
    )
  )
);

describe("default assault consequences (universal)", () => {
  it("civilian/guest first shove holds the player", () => {
    // Blackwood player is official — use white room patient (civilian)
    const state = createInitialPlaythrough(whiteRoom, "def-assault-1");
    const r = applyDefaultAssaultConsequences(whiteRoom, state, {
      targetId: "dr-silas-more",
      manner: "shove",
      attempts: 1,
      caseHandled: false,
    });
    expect(r.state.playerStatus.control).toBe("held");
    expect(r.state.playerStatus.controlledBy).toBe("dr-silas-more");
    expect(r.state.playerStatus.condition).toBe("bruised");
    expect(r.state.playerStatus.threat).toBe("threatened");
    expect(r.state.characterState["dr-silas-more"]?.willingness).toBe("hostile");
    expect(r.justHappened.some((j) => j.id.startsWith("assault_default_"))).toBe(
      true
    );
  });

  it("official first shove rattles target but leaves player free", () => {
    const state = createInitialPlaythrough(blackwood, "def-assault-2");
    const r = applyDefaultAssaultConsequences(blackwood, state, {
      targetId: "vale",
      manner: "shove",
      attempts: 1,
      caseHandled: false,
    });
    expect(r.state.playerStatus.control).toBe("free");
    expect(r.state.playerStatus.threat).toBe("watched");
    expect(r.state.characterState.vale?.willingness).toBe("hostile");
  });

  it("skips defaults when case already handled", () => {
    const state = createInitialPlaythrough(whiteRoom, "def-assault-3");
    const r = applyDefaultAssaultConsequences(whiteRoom, state, {
      targetId: "dr-silas-more",
      manner: "shove",
      attempts: 1,
      caseHandled: true,
    });
    expect(r.state.playerStatus.control).toBe("free");
    expect(r.justHappened).toHaveLength(0);
  });

  it("assaultCaseHandled detects control justHappened", () => {
    expect(
      assaultCaseHandled([], [{ id: "player_control_held", summary: "held" }])
    ).toBe(true);
    expect(assaultCaseHandled(["staff_assault_first"], [])).toBe(true);
    expect(assaultCaseHandled([], [{ id: "moved", summary: "x" }])).toBe(false);
  });

  it("repeat civilian assault escalates to restrained", () => {
    const state = createInitialPlaythrough(whiteRoom, "def-assault-4");
    const r = applyDefaultAssaultConsequences(whiteRoom, state, {
      targetId: "bram-holt",
      manner: "hit",
      attempts: 2,
      caseHandled: false,
    });
    expect(r.state.playerStatus.control).toBe("restrained");
    expect(r.state.playerStatus.condition).toBe("injured");
    expect(r.state.playerStatus.threat).toBe("assaulted");
  });

  it("slap hium typo resolves to present doctor and holds", () => {
    let state = createInitialPlaythrough(whiteRoom, "def-slap-typo");
    state = {
      ...state,
      locationId: "ward-office",
      characterState: {
        ...state.characterState,
        "dr-silas-more": {
          ...state.characterState["dr-silas-more"]!,
          locationId: "ward-office",
        },
        "june-pell": {
          ...state.characterState["june-pell"]!,
          locationId: "ward-office",
        },
      },
    };
    const { patch, notes } = directorIntentsToPatch(
      whiteRoom,
      state,
      { intents: [{ type: "other", note: "unclear" }] },
      "slap hium"
    );
    expect(notes.some((n) => n.includes("assault→"))).toBe(true);
    expect(patch.setFlags?.last_assault_target).toBe("dr-silas-more");
  });

  it("knee him in the nuts is assault", () => {
    let state = createInitialPlaythrough(whiteRoom, "def-knee");
    state = {
      ...state,
      locationId: "ward-office",
      characterState: {
        ...state.characterState,
        "dr-silas-more": {
          ...state.characterState["dr-silas-more"]!,
          locationId: "ward-office",
        },
        "june-pell": {
          ...state.characterState["june-pell"]!,
          locationId: "ward-office",
        },
      },
    };
    const { patch, notes } = directorIntentsToPatch(
      whiteRoom,
      state,
      { intents: [{ type: "other", note: "x" }] },
      "knee him in the nuts"
    );
    expect(notes.some((n) => n.includes("assault→"))).toBe(true);
    expect(patch.setFlags?.last_assault_target).toBe("dr-silas-more");
    expect(patch.setFlags?.last_assault_manner).toBe("kick");
  });

  it("pee on the floor is misconduct and seizes civilian", () => {
    expect(inputLooksLikeMisconduct("pee on the floor")).toBe(true);
    let state = createInitialPlaythrough(whiteRoom, "def-pee");
    state = {
      ...state,
      locationId: "ward-office",
      characterState: {
        ...state.characterState,
        "dr-silas-more": {
          ...state.characterState["dr-silas-more"]!,
          locationId: "ward-office",
        },
      },
    };
    const { patch, notes } = directorIntentsToPatch(
      whiteRoom,
      state,
      { intents: [{ type: "other", note: "gross" }] },
      "pee on the floor"
    );
    expect(notes.some((n) => n.startsWith("misconduct→"))).toBe(true);
    expect(patch.setFlags?.player_misconduct).toBe(true);

    const r = applyDefaultMisconductConsequences(whiteRoom, state, {
      kind: "urinate",
      attempts: 1,
      witnessId: "dr-silas-more",
      caseHandled: false,
    });
    expect(r.state.playerStatus.control).toBe("held");
    expect(r.state.playerStatus.condition).toBe("shaken");
    expect(r.state.playerStatus.threat).toBe("threatened");
  });
});
