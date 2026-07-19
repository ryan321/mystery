import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import {
  applyDefaultAssaultConsequences,
  assaultCaseHandled,
} from "./assault-default.js";

const blackwood = parseMysteryDefinition(
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
});
