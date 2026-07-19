import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import { applyDefaultPlayerImpact } from "./player-impact.js";
import { directorIntentsToPatch } from "./intents-to-patch.js";

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

describe("social / world pushback on player", () => {
  it("first provoke warns", () => {
    let state = createInitialPlaythrough(whiteRoom, "pi-warn");
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
    const r = applyDefaultPlayerImpact(whiteRoom, state, {
      kind: "provoke",
      targetId: "dr-silas-more",
      manner: "keeps arguing after being told to sit",
      pushback: "warn",
      caseHandled: false,
    });
    expect(r.state.playerStatus.threat).toBe("watched");
    expect(r.state.playerStatus.control).toBe("free");
    expect(r.state.flags["pressure_on_dr-silas-more"]).toBe(1);
    expect(r.justHappened.some((j) => j.id.includes("warn"))).toBe(true);
  });

  it("eject moves player out of the room", () => {
    let state = createInitialPlaythrough(whiteRoom, "pi-eject");
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
    const r = applyDefaultPlayerImpact(whiteRoom, state, {
      kind: "provoke",
      targetId: "dr-silas-more",
      manner: "refuses to leave the office",
      pushback: "eject",
      ejectToLocationId: "corridor",
      caseHandled: false,
    });
    expect(r.state.locationId).toBe("corridor");
    expect(r.state.playerStatus.tags).toContain("ejected");
    expect(r.state.playerStatus.threat).toBe("threatened");
  });

  it("hazard dumps player into fall location", () => {
    let state = createInitialPlaythrough(whiteRoom, "pi-hazard");
    // Use white room guest-room-less: synthesize with pier-like move
    // white room has no hazards — call applyDefaultHazard with explicit fall
    const r = applyDefaultPlayerImpact(whiteRoom, state, {
      kind: "hazard",
      manner: "A rotten board gives way under your boot.",
      pushback: "eject",
      ejectToLocationId: "corridor",
      condition: "shaken",
      tag: "soaked",
      caseHandled: false,
    });
    expect(r.state.locationId).toBe("corridor");
    expect(r.state.playerStatus.condition).toBe("shaken");
    expect(r.state.playerStatus.tags).toContain("soaked");
    expect(r.justHappened.some((j) => j.id.startsWith("hazard_"))).toBe(true);
  });

  it("physical.provoke from director becomes world_push flags", () => {
    let state = createInitialPlaythrough(whiteRoom, "pi-dir");
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
    const { notes, patch } = directorIntentsToPatch(
      whiteRoom,
      state,
      {
        intents: [{ type: "talk", characterId: "dr-silas-more" }],
        physical: {
          kind: "provoke",
          characterId: "dr-silas-more",
          manner: "won't stop arguing",
          pushback: "eject",
          ejectToLocationId: "corridor",
        },
      },
      "I keep arguing with the doctor and refuse to leave"
    );
    expect(notes.some((n) => n.startsWith("provoke→"))).toBe(true);
    expect(patch.setFlags?.player_world_push).toBe(true);
    expect(patch.setFlags?.last_pushback).toBe("eject");
    expect(patch.setFlags?.world_push_target).toBe("dr-silas-more");
  });
});
