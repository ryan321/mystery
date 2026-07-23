import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import {
  fixtureCanOpen,
  fixtureContents,
  fixtureIsLocked,
  fixtureYields,
  itemReadableText,
  matchItemUse,
} from "./items.js";
import { directorIntentsToPatch } from "./intents-to-patch.js";
import { validateAndApplyPatch } from "./validate-patch.js";

const baseDef = parseMysteryDefinition(
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

describe("fixtureContents — single discovery path", () => {
  it("prefers container.contains over onInspect.revealsEvidenceIds", () => {
    const insp = {
      id: "desk",
      name: "Desk",
      container: {
        locked: false,
        contains: ["from-container"],
      },
      onInspect: {
        revealsEvidenceIds: ["from-legacy"],
      },
    };
    expect(fixtureContents(insp as never)).toEqual(["from-container"]);
  });

  it("falls back to onInspect.revealsEvidenceIds when no container", () => {
    const insp = {
      id: "desk",
      name: "Desk",
      onInspect: { revealsEvidenceIds: ["legacy-clue"] },
    };
    expect(fixtureContents(insp as never)).toEqual(["legacy-clue"]);
  });
});

describe("fixture open/locked", () => {
  it("reads locked state from container + key in hand", () => {
    const def = {
      ...baseDef,
      evidence: [
        ...baseDef.evidence,
        {
          id: "test-key",
          name: "Test Key",
          description: "A key",
          usableOn: [],
          redHerring: false,
        },
      ],
      locations: baseDef.locations.map((l, i) =>
        i === 0
          ? {
              ...l,
              inspectables: [
                ...l.inspectables,
                {
                  id: "locked-box",
                  name: "Locked box",
                  container: {
                    locked: true,
                    contains: ["black-thread"],
                  },
                  onInspect: {
                    requiresEvidenceIds: ["test-key"],
                    revealsEvidenceIds: ["black-thread"],
                  },
                },
              ],
            }
          : l
      ),
    };
    const state = createInitialPlaythrough(def as never, "i-lock");
    const loc = def.locations[0];
    const box = loc.inspectables.find((x) => x.id === "locked-box")!;
    expect(fixtureIsLocked(def as never, state, box as never)).toBe(true);
    expect(fixtureCanOpen(def as never, state, box as never)).toBe(false);

    const withKey = { ...state, evidenceIds: ["test-key"] };
    expect(fixtureIsLocked(def as never, withKey, box as never)).toBe(false);
    expect(fixtureCanOpen(def as never, withKey, box as never)).toBe(true);
    expect(fixtureYields(box as never, "black-thread")).toBe(true);
  });
});

describe("readable + usableOn", () => {
  it("itemReadableText returns authored body", () => {
    const def = {
      ...baseDef,
      evidence: baseDef.evidence.map((e) =>
        e.id === "vale-letter"
          ? { ...e, readable: { text: "Meet me at midnight." } }
          : e
      ),
    };
    expect(itemReadableText(def as never, "vale-letter")).toBe(
      "Meet me at midnight."
    );
    expect(itemReadableText(def as never, "nope")).toBeUndefined();
  });

  it("matchItemUse finds a held key aimed at a fixture", () => {
    const def = {
      ...baseDef,
      evidence: baseDef.evidence.map((e) =>
        e.id === "brass-key"
          ? {
              ...e,
              usableOn: [
                {
                  targetId: "study-desk",
                  outcome: [
                    { type: "set_game_flag", id: "desk_unlocked", value: true },
                  ],
                },
              ],
            }
          : e
      ),
    };
    const state = {
      ...createInitialPlaythrough(def as never, "use-1"),
      evidenceIds: ["brass-key"],
    };
    const m = matchItemUse(def as never, state, "brass-key", "study-desk");
    expect(m?.outcome[0]?.type).toBe("set_game_flag");
  });

  it("use intent with usableOn applies outcome flags", () => {
    const startLoc = baseDef.player.startingLocationId;
    const def = {
      ...baseDef,
      evidence: baseDef.evidence.map((e) =>
        e.id === "brass-key"
          ? {
              ...e,
              usableOn: [
                {
                  targetId: "study-desk",
                  outcome: [
                    { type: "set_game_flag", id: "desk_open", value: true },
                  ],
                },
              ],
            }
          : e
      ),
      locations: baseDef.locations.map((l) =>
        l.id === startLoc
          ? {
              ...l,
              inspectables: [
                ...l.inspectables,
                {
                  id: "study-desk",
                  name: "Study desk",
                  onInspect: {},
                },
              ],
            }
          : l
      ),
    } as typeof baseDef;

    const state = {
      ...createInitialPlaythrough(def, "use-2"),
      evidenceIds: ["brass-key"],
      locationId: startLoc,
    };

    const { patch } = directorIntentsToPatch(
      def,
      state,
      {
        intents: [
          {
            type: "use",
            evidenceId: "brass-key",
            targetHint: "study desk",
          },
        ],
      },
      "I use the brass key on the study desk"
    );

    expect(patch.useItemId).toBe("brass-key");
    expect(patch.useTargetId).toBe("study-desk");

    const result = validateAndApplyPatch(def, state, patch);
    expect(result.applied.useItemId).toBe("brass-key");
    expect(result.nextState.flags.desk_open).toBe(true);
  });
});
