import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import { resolveWorldToPlayer } from "./resolve-world-to-player.js";

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

describe("resolveWorldToPlayer (core engine phase)", () => {
  it("applies assault defaults when no case beat handled force", () => {
    let state = createInitialPlaythrough(whiteRoom, "w2p-1");
    state = {
      ...state,
      locationId: "ward-office",
      flags: {
        ...state.flags,
        assault_attempts: 1,
        last_assault_target: "dr-silas-more",
        last_assault_manner: "slap",
        player_assaulted_someone: true,
      },
      characterState: {
        ...state.characterState,
        "dr-silas-more": {
          ...state.characterState["dr-silas-more"]!,
          locationId: "ward-office",
        },
      },
    };
    // Pretend case beat already fired so we test the path still records attempt
    const r = resolveWorldToPlayer(whiteRoom, state, {
      notes: ["assault→dr-silas-more", "assault_flags→dr-silas-more"],
      applied: {
        setFlags: {
          player_assaulted_someone: true,
          last_assault_target: "dr-silas-more",
          last_assault_manner: "slap",
          assault_attempts: 1,
        },
      },
      firedBeatIds: [],
      justHappenedSoFar: [],
      rejected: [],
    });
    expect(r.state.playerStatus.control).toBe("held");
    expect(r.justHappened.some((j) => j.id.startsWith("assault_attempt_"))).toBe(
      true
    );
  });

  it("ejects on provoke pushback", () => {
    let state = createInitialPlaythrough(whiteRoom, "w2p-2");
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
    const r = resolveWorldToPlayer(whiteRoom, state, {
      notes: ["provoke→refuse to leave (physical.ai)", "pushback→eject"],
      applied: {
        setFlags: {
          player_world_push: true,
          last_world_push_kind: "provoke",
          last_world_push_manner: "refuse to leave",
          last_pushback: "eject",
          world_push_target: "dr-silas-more",
          eject_to_location: "corridor",
        },
      },
      firedBeatIds: [],
      justHappenedSoFar: [],
      rejected: [],
    });
    expect(r.state.locationId).toBe("corridor");
    expect(r.state.playerStatus.tags).toContain("ejected");
  });

  it("stages blocked leave when control is held", () => {
    let state = createInitialPlaythrough(whiteRoom, "w2p-3");
    state = {
      ...state,
      playerStatus: {
        ...state.playerStatus,
        control: "held",
        controlledBy: "dr-silas-more",
      },
    };
    const r = resolveWorldToPlayer(whiteRoom, state, {
      notes: [],
      applied: {},
      firedBeatIds: [],
      justHappenedSoFar: [],
      rejected: ["You cannot walk away — you are being held."],
    });
    expect(
      r.justHappened.some((j) => j.id.startsWith("player_control_block_"))
    ).toBe(true);
  });
});
