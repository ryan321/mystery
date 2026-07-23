import { describe, expect, it } from "vitest";
import { gameFor } from "./registry.js";
import { blackwoodGame, BLACKWOOD_ID } from "./blackwood.js";

describe("gameFor", () => {
  it("dispatches Blackwood to its own owned module", () => {
    const game = gameFor(BLACKWOOD_ID);
    expect(game).toBe(blackwoodGame);
    expect(game.id).toBe(BLACKWOOD_ID);
    expect(typeof game.runTurn).toBe("function");
  });

  it("falls back to a shared default module for an unmigrated case", () => {
    const game = gameFor("some-other-mystery");
    expect(game).not.toBe(blackwoodGame);
    expect(game.id).toBe("some-other-mystery"); // default is bound to the case
    expect(typeof game.runTurn).toBe("function");
  });
});
