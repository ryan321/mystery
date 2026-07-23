import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import {
  directorIntentsToPatch,
  inputLooksLikeAssault,
} from "./intents-to-patch.js";
import { validateAndApplyPatch } from "./validate-patch.js";
import { evaluateBeats } from "./beats.js";

const def = parseMysteryDefinition(
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

describe("white room staff assault", () => {
  it("detects shove language as assault", () => {
    expect(inputLooksLikeAssault("push Dr. More onto the ground")).toBe(true);
    expect(inputLooksLikeAssault("push him out of the way")).toBe(true);
    expect(inputLooksLikeAssault("knock on the door")).toBe(false);
    expect(inputLooksLikeAssault("ask More about the file")).toBe(false);
  });

  it("heuristic maps push More to assault flags without director assault intent", () => {
    let state = createInitialPlaythrough(def, "wr-assault-1");
    state = validateAndApplyPatch(def, state, {
      setLocationId: "corridor",
    }).nextState;
    state = validateAndApplyPatch(def, state, {
      setLocationId: "ward-office",
    }).nextState;

    const { patch, notes } = directorIntentsToPatch(
      def,
      state,
      { intents: [{ type: "talk", characterHint: "more" }] },
      "push Dr. More onto the ground"
    );
    expect(notes.some((n) => n.includes("assault→"))).toBe(true);
    expect(patch.setFlags?.player_assaulted_staff).toBe(true);
    expect(patch.setFlags?.last_assault_target).toBe("dr-silas-more");
    expect(Number(patch.setFlags?.assault_attempts)).toBe(1);
  });

  it("first assault holds the player and orders chemical restraint", () => {
    let state = createInitialPlaythrough(def, "wr-assault-2");
    state = validateAndApplyPatch(def, state, {
      setLocationId: "corridor",
    }).nextState;
    state = validateAndApplyPatch(def, state, {
      setLocationId: "ward-office",
    }).nextState;
    state = validateAndApplyPatch(def, state, {
      setFlags: {
        player_assaulted_staff: true,
        assault_attempts: 1,
        last_assault_target: "dr-silas-more",
        last_assault_manner: "knock_down",
        "assaulted_dr-silas-more": true,
      },
    }).nextState;

    const beats = evaluateBeats(def, state, 3);
    expect(beats.fired).toContain("staff_assault_first");
    expect(beats.state.playerStatus.control).toBe("held");
    expect(beats.state.playerStatus.condition).toBe("bruised");
    expect(beats.state.playerStatus.threat).toBe("threatened");
    expect(beats.state.flags.chemical_restraint_ordered).toBe(true);
    expect(beats.state.clocks.chemical_restraint).toBeGreaterThan(0);
    expect(beats.state.characterState["bram-holt"]?.locationId).toBe(
      "ward-office"
    );
    // NOTE: "held" is now a breakable grip (a determined player can walk out of
    // it — see validate-patch move block); only restrained/downed/unconscious
    // block a voluntary exit. The white-room's genuine-restraint mechanic will
    // move to `restrained` when it's reworked as its own game module.
  });

  it("second assault applies full chemical restraint", () => {
    let state = createInitialPlaythrough(def, "wr-assault-3");
    state = {
      ...state,
      locationId: "ward-office",
      flags: {
        ...state.flags,
        player_assaulted_staff: true,
        assault_attempts: 2,
        chemical_restraint_ordered: true,
        last_assault_target: "dr-silas-more",
      },
      playerStatus: {
        ...state.playerStatus,
        threat: "threatened",
        condition: "bruised",
        control: "held",
        controlledBy: "dr-silas-more",
        tags: ["violent_episode"],
      },
      firedBeatIds: ["staff_assault_first"],
      clocks: { chemical_restraint: 2 },
    };

    const beats = evaluateBeats(def, state, 3);
    expect(beats.fired).toContain("staff_chemical_restraint");
    expect(beats.state.playerStatus.control).toBe("restrained");
    expect(beats.state.playerStatus.condition).toBe("injured");
    expect(beats.state.flags.full_restraint_applied).toBe(true);
    expect(beats.state.playerStatus.tags).toContain("chemically_restrained");
  });
});
