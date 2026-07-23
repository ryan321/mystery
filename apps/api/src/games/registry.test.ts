import { describe, expect, it } from "vitest";
import { createPlatform, gameFor } from "./registry.js";
import { blackwoodGame, BLACKWOOD_ID } from "./blackwood.js";
import { standardTurn } from "./standard-turn.js";

describe("gameFor", () => {
  it("dispatches an owned module for a registered case", () => {
    const game = gameFor(BLACKWOOD_ID);
    expect(game).toBe(blackwoodGame);
    expect(game.id).toBe(BLACKWOOD_ID);
    expect(typeof game.runTurn).toBe("function");
  });

  it("falls back to a default module bound to the caseId", () => {
    const game = gameFor("some-other-mystery");
    expect(game).not.toBe(blackwoodGame);
    expect(game.id).toBe("some-other-mystery");
    expect(typeof game.runTurn).toBe("function");
  });
});

describe("createPlatform", () => {
  it("exposes the floor services games must use", () => {
    const p = createPlatform(null);
    expect(p.llmConfig).toBeNull();
    expect(typeof p.createInitialState).toBe("function");
    expect(typeof p.buildPlayerView).toBe("function");
    expect(typeof p.computeProgress).toBe("function");
  });
});

describe("standardTurn", () => {
  it("is the composable helper modules call", () => {
    expect(typeof standardTurn).toBe("function");
  });
});
