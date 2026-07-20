import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import { validateAndApplyPatch, scoreAccusation } from "./validate-patch.js";
import { evaluateBeats, advancePassiveTime } from "./beats.js";
import { directorIntentsToPatch } from "./intents-to-patch.js";

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

describe("validateAndApplyPatch", () => {
  it("creates playthrough at entrance hall with entity state", () => {
    const state = createInitialPlaythrough(def, "test-1");
    expect(state.locationId).toBe("entrance-hall");
    expect(state.characterState.henshaw?.willingness).toBe("open");
    expect(state.environment.weather).toBe("storm");
    expect(state.time?.slotId).toBe("just_after_eleven");
    expect(state.relationshipState.henshaw_loyalty_family?.active).toBe(true);
    expect(state.relationshipState.vale_debt_blackwood?.knownToPlayer).toBe(
      false
    );
  });

  it("letter beat reveals private relationship edges", () => {
    let state = createInitialPlaythrough(def, "test-rel");
    state = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    }).nextState;
    state = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["brass-key", "vale-letter"],
      setFlags: { found_vale_letter: true },
    }).nextState;
    const beats = evaluateBeats(def, state, 3, {
      source: "player",
      discoveredEvidenceIds: ["vale-letter"],
    });
    expect(beats.fired).toContain("letter_unlocks_deepening");
    expect(
      beats.state.relationshipState.vale_debt_blackwood?.knownToPlayer
    ).toBe(true);
    expect(beats.state.relationshipState.clara_wary_vale?.knownToPlayer).toBe(
      true
    );
    expect(beats.state.relationshipState.vale_fear_exposure?.strength).toBe(3);
    expect(beats.state.characterState.henshaw?.trust).toBeGreaterThanOrEqual(2);
  });

  it("on_discover beats do not fire on tick without discovery", () => {
    let state = createInitialPlaythrough(def, "test-trigger-tick");
    state = {
      ...state,
      evidenceIds: ["vale-letter"],
      flags: { ...state.flags, found_vale_letter: true },
    };
    const tick = evaluateBeats(def, state, 3, { source: "tick" });
    expect(tick.fired).not.toContain("letter_unlocks_deepening");
  });

  it("on_discover fires only with discovery context", () => {
    let state = createInitialPlaythrough(def, "test-trigger-disc");
    state = {
      ...state,
      evidenceIds: ["vale-letter"],
      flags: { ...state.flags, found_vale_letter: true },
    };
    const noCtx = evaluateBeats(def, state, 3, { source: "player" });
    expect(noCtx.fired).not.toContain("letter_unlocks_deepening");
    const withCtx = evaluateBeats(def, state, 3, {
      source: "player",
      discoveredEvidenceIds: ["vale-letter"],
    });
    expect(withCtx.fired).toContain("letter_unlocks_deepening");
  });

  it("clock expiry on tick fires failure before player acts", () => {
    let state = createInitialPlaythrough(def, "test-tick-fail");
    state = {
      ...state,
      clocks: { vale_retaliation: 0 },
      characterState: {
        ...state.characterState,
        vale: {
          ...state.characterState.vale!,
          willingness: "hostile",
        },
      },
    };
    const tick = evaluateBeats(def, state, 3, { source: "tick" });
    expect(tick.fired).toContain("failure_vale_retaliation");
    expect(tick.state.status).toBe("denouement");
    expect(tick.state.endingId).toBe("failure_murdered");
  });

  it("opening drawer with key unlocks object and sets stages", () => {
    let state = createInitialPlaythrough(def, "test-unlock");
    state = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    }).nextState;
    expect(state.objectState["desk-drawer"]?.locked).toBe(true);
    state = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["brass-key"],
    }).nextState;
    expect(state.objectState["brass-key"]?.holder).toBe("player");
    expect(state.objectState["brass-key"]?.stage).toBe("taken");
    const got = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["vale-letter"],
      setFlags: { found_vale_letter: true },
    });
    expect(got.evidenceAdded).toContain("vale-letter");
    expect(got.nextState.objectState["desk-drawer"]?.locked).toBe(false);
    expect(got.nextState.objectState["vale-letter"]?.stage).toBe("taken");
    expect(got.nextState.objectState["vale-letter"]?.holder).toBe("player");
  });

  it("inventory items have mutable condition/tags/flags and examine/use counts", () => {
    let state = createInitialPlaythrough(def, "test-inv-state");
    state = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    }).nextState;
    state = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["brass-key"],
    }).nextState;
    expect(state.objectState["brass-key"]?.condition).toBe("intact");
    expect(state.objectState["brass-key"]?.timesUsed).toBe(0);

    const used = validateAndApplyPatch(def, state, {
      useItemId: "brass-key",
    });
    expect(used.nextState.objectState["brass-key"]?.timesUsed).toBe(1);

    const exam = validateAndApplyPatch(def, used.nextState, {
      examineItemId: "brass-key",
      setItemFlags: { "brass-key": { soot_stained: true } },
    });
    expect(exam.nextState.objectState["brass-key"]?.timesExamined).toBe(1);
    expect(exam.nextState.objectState["brass-key"]?.flags.soot_stained).toBe(
      true
    );

    const inv = validateAndApplyPatch(def, exam.nextState, {
      requestInventory: true,
    });
    expect(inv.applied.requestInventory).toBe(true);
    expect(inv.nextState.evidenceIds).toContain("brass-key");
  });

  it("allows move to library", () => {
    const state = createInitialPlaythrough(def, "test-2");
    const ok = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    });
    expect(ok.nextState.locationId).toBe("library");
  });

  it("grants vase evidence", () => {
    const state = createInitialPlaythrough(def, "test-3");
    const got = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["black-thread", "muddy-boot-print"],
      setFlags: { examined_vase: true, found_boot_print: true },
    });
    expect(got.evidenceAdded).toEqual(
      expect.arrayContaining(["black-thread", "muddy-boot-print"])
    );
  });

  it("requires brass-key evidence for letter (not magic flag)", () => {
    let state = createInitialPlaythrough(def, "test-4");
    state = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    }).nextState;

    const withoutKey = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["vale-letter"],
    });
    expect(withoutKey.evidenceAdded).not.toContain("vale-letter");

    state = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["brass-key"],
    }).nextState;
    expect(state.evidenceIds).toContain("brass-key");

    const withKey = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["vale-letter"],
      setFlags: { found_vale_letter: true },
    });
    expect(withKey.evidenceAdded).toContain("vale-letter");
  });

  it("scores accusation for Vale success", () => {
    const score = scoreAccusation(def, {
      summary:
        "Vale killed him in the hall during a struggle over the letter; fraud exposure motive; vase crashed on the stairs.",
      suspectIds: ["vale"],
    });
    expect(score).toBe("success");
  });

  it("allows cold correct accusation without any evidence (lucky path)", () => {
    const state = createInitialPlaythrough(def, "test-lucky");
    expect(state.evidenceIds).toEqual([]);
    const got = validateAndApplyPatch(def, state, {
      accuse: {
        summary:
          "Vale did it — he struck Blackwood in the hall over the fraud letter!",
        suspectIds: ["vale"],
        method: "struggle in the hall",
        motive: "fraud exposure",
      },
    });
    // Wrap-up enabled: judgment → denouement, not hard solved
    expect(got.nextState.status).toBe("denouement");
    expect(got.accusation?.path).toBe("lucky");
    expect(got.accusation?.score).toBe("success");
    expect(got.nextState.endingId).toBe("success_lucky");
    expect(got.nextState.resolution?.outcome).toBe("success");
    expect(got.nextState.evidenceIds).toEqual([]);
  });

  it("marks earned path when player holds critical evidence", () => {
    let state = createInitialPlaythrough(def, "test-earned");
    state = {
      ...state,
      evidenceIds: ["vale-letter", "muddy-boot-print"],
      flags: { ...state.flags, found_vale_letter: true },
    };
    const got = validateAndApplyPatch(def, state, {
      accuse: {
        summary:
          "Vale killed him in the hall during a struggle; fraud exposure motive.",
        suspectIds: ["vale"],
      },
    });
    expect(got.nextState.status).toBe("denouement");
    expect(got.accusation?.path).toBe("earned");
    expect(got.nextState.endingId).toBe("success_earned");
  });

  it("identity alone is partial under identity_plus_one policy", () => {
    const state = createInitialPlaythrough(def, "test-id-only");
    const got = validateAndApplyPatch(def, state, {
      accuse: {
        summary: "It was Vale. He is the killer.",
        suspectIds: ["vale"],
      },
    });
    expect(got.accusation?.identityCorrect).toBe(true);
    expect(got.nextState.status).toBe("denouement");
    expect(got.accusation?.score).toBe("partial");
    expect(got.nextState.endingId).toBe("partial");
  });

  it("denouement fires wrap-up beat for successful judgment", () => {
    let state = createInitialPlaythrough(def, "test-wrap");
    const judged = validateAndApplyPatch(def, state, {
      accuse: {
        summary:
          "Vale killed him in the hall over fraud — the letter proves motive.",
        suspectIds: ["vale"],
      },
    }).nextState;
    expect(judged.status).toBe("denouement");
    const beats = evaluateBeats(def, judged, 3);
    expect(beats.fired).toContain("wrap_success_vale_breaks");
    expect(beats.state.characterState.vale?.stance).toBe("broken_confessing");
    expect(beats.state.characterState.vale?.locationId).toBe("entrance-hall");
  });

  it("wrong accusation enters denouement with failure resolution", () => {
    const state = createInitialPlaythrough(def, "test-wrong-wrap");
    const got = validateAndApplyPatch(def, state, {
      accuse: {
        summary: "Henshaw did it for the silverware",
        suspectIds: ["henshaw"],
      },
    });
    expect(got.nextState.status).toBe("denouement");
    expect(got.nextState.resolution?.outcome).toBe("failure");
    expect(got.nextState.endingId).toBe("failure_wrong_accusation");
    const beats = evaluateBeats(def, got.nextState, 3);
    expect(beats.fired).toContain("wrap_failure_wrong_man");
  });

  it("fires letter beat chain: phase, time, clara moves, henshaw knowledge", () => {
    let state = createInitialPlaythrough(def, "test-beats");
    state = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    }).nextState;
    state = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["brass-key"],
    }).nextState;
    state = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["vale-letter"],
      setFlags: { found_vale_letter: true },
    }).nextState;

    const beats = evaluateBeats(def, state, 3, {
      source: "player",
      discoveredEvidenceIds: ["vale-letter"],
    });
    expect(beats.fired).toContain("letter_unlocks_deepening");
    expect(beats.state.phaseId).toBe("deepening");
    expect(beats.state.time?.slotId).toBe("late_evening");
    expect(beats.state.characterState.clara?.locationId).toBe("entrance-hall");
    expect(
      beats.state.characterMemory.henshaw?.revealedBeatIds
    ).toContain("henshaw-saw-vale-earlier");
  });

  it("presenting letter to vale fires cornered beat", () => {
    let state = createInitialPlaythrough(def, "test-present");
    // Seed inventory + co-location (letter needs key in real play; tests bypass discovery)
    state = {
      ...state,
      locationId: "library",
      evidenceIds: ["vale-letter"],
      flags: { ...state.flags, found_vale_letter: true },
      presented: [
        {
          evidenceId: "vale-letter",
          characterId: "vale",
          turn: 1,
        },
      ],
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
          dressing: [],
        },
      },
    };

    const beats = evaluateBeats(def, state, 3, {
      source: "player",
      presented: [{ evidenceId: "vale-letter", characterId: "vale" }],
    });
    expect(beats.fired).toContain("vale_cornered_by_letter");
    expect(beats.state.characterState.vale?.alibiStatus).toBe("broken");
    expect(beats.state.characterState.vale?.willingness).toBe("hostile");
    expect(beats.state.playerStatus.threat).toBe("threatened");
    expect(beats.state.playerStatus.condition).toBe("bruised");
    expect(beats.state.playerStatus.control).toBe("held");
    expect(beats.state.playerStatus.controlledBy).toBe("vale");
    expect(beats.state.playerStatus.tags).toContain("vale_threat");
    expect(beats.justHappened.some((j) => j.id.startsWith("player_harm_"))).toBe(
      true
    );
    expect(
      beats.justHappened.some((j) => j.id === "player_control_held")
    ).toBe(true);
  });

  it("letter while away from guest room ransacks the detective's room", () => {
    let state = createInitialPlaythrough(def, "test-ransack");
    expect(state.playerStatus.safeHavenCompromised).toBe(false);

    state = validateAndApplyPatch(def, state, {
      setLocationId: "library",
    }).nextState;
    state = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["brass-key"],
    }).nextState;
    state = validateAndApplyPatch(def, state, {
      addEvidenceIds: ["vale-letter"],
      setFlags: { found_vale_letter: true },
    }).nextState;

    const beats = evaluateBeats(def, state, 3);
    expect(beats.fired).toContain("letter_unlocks_deepening");
    expect(beats.fired).toContain("inspector_room_ransacked");
    expect(beats.state.playerStatus.safeHavenCompromised).toBe(true);
    expect(beats.state.playerStatus.threat).toBe("watched");
    expect(beats.state.playerStatus.condition).toBe("shaken");
    expect(beats.state.playerStatus.tags).toContain("room_searched");
    expect(beats.state.playerStatus.tags).toContain("robbed");
    expect(beats.state.flags.inspector_room_ransacked).toBe(true);
    expect(beats.state.evidenceIds).not.toContain("brass-key");
    expect(beats.justHappened.some((j) => j.id === "stolen_brass-key")).toBe(
      true
    );
    expect(
      beats.state.locationState["guest-room"]?.descriptionAppend
    ).toMatch(/drawers hang open/i);
    expect(beats.state.notebook.some((n) => /searched/i.test(n.text))).toBe(
      true
    );
  });

  it("does not ransack while player is in the guest room", () => {
    let state = createInitialPlaythrough(def, "test-no-ransack-home");
    state = validateAndApplyPatch(def, state, {
      setLocationId: "guest-room",
    }).nextState;
    state = {
      ...state,
      evidenceIds: ["vale-letter"],
      flags: { ...state.flags, found_vale_letter: true },
      firedBeatIds: ["letter_unlocks_deepening"],
      phaseId: "deepening",
    };
    const beats = evaluateBeats(def, state, 3);
    expect(beats.fired).not.toContain("inspector_room_ransacked");
    expect(beats.state.playerStatus.safeHavenCompromised).toBe(false);
  });

  it("threat escalates and does not drop from ransack after cornered", () => {
    let state = createInitialPlaythrough(def, "test-threat-order");
    state = {
      ...state,
      locationId: "entrance-hall",
      evidenceIds: ["vale-letter"],
      flags: { ...state.flags, found_vale_letter: true },
      firedBeatIds: ["letter_unlocks_deepening"],
      phaseId: "deepening",
      playerStatus: {
        threat: "threatened",
        condition: "bruised",
        control: "free",
        safeHavenCompromised: false,
        tags: ["vale_threat"],
        flags: {},
      },
    };
    const beats = evaluateBeats(def, state, 3);
    expect(beats.fired).toContain("inspector_room_ransacked");
    expect(beats.state.playerStatus.threat).toBe("threatened");
    expect(beats.state.playerStatus.condition).toBe("bruised");
    expect(beats.state.playerStatus.safeHavenCompromised).toBe(true);
  });

  it("wrong accusation selects wrong_accusation failure ending", () => {
    let state = createInitialPlaythrough(def, "test-wrong-accuse");
    const got = validateAndApplyPatch(def, state, {
      accuse: {
        summary: "Henshaw did it for the silverware",
        suspectIds: ["henshaw"],
      },
    });
    expect(got.nextState.status).toBe("denouement");
    expect(got.nextState.endingId).toBe("failure_wrong_accusation");
    expect(got.nextState.flags.case_failed).toBe(true);
  });

  it("expired vale retaliation clock ends case as murdered", () => {
    let state = createInitialPlaythrough(def, "test-murdered");
    state = {
      ...state,
      status: "active",
      clocks: { vale_retaliation: 0 },
      characterState: {
        ...state.characterState,
        vale: {
          ...state.characterState.vale!,
          willingness: "hostile",
        },
      },
    };
    const beats = evaluateBeats(def, state, 3);
    expect(beats.fired).toContain("failure_vale_retaliation");
    expect(beats.state.status).toBe("denouement");
    expect(beats.state.endingId).toBe("failure_murdered");
    expect(beats.state.playerStatus.threat).toBe("assaulted");
    expect(beats.state.playerStatus.condition).toBe("incapacitated");
    expect(beats.state.playerStatus.control).toBe("unconscious");
  });

  it("vale warning assault fires at low retaliation clock and injures", () => {
    let state = createInitialPlaythrough(def, "test-warning-assault");
    state = {
      ...state,
      status: "active",
      locationId: "library",
      clocks: { vale_retaliation: 3 },
      evidenceIds: ["vale-letter", "brass-key"],
      characterState: {
        ...state.characterState,
        vale: {
          ...state.characterState.vale!,
          willingness: "hostile",
        },
      },
    };
    const beats = evaluateBeats(def, state, 3);
    expect(beats.fired).toContain("vale_warning_assault");
    expect(beats.fired).not.toContain("failure_vale_retaliation");
    expect(beats.state.status).toBe("active");
    expect(beats.state.playerStatus.threat).toBe("assaulted");
    expect(beats.state.playerStatus.condition).toBe("injured");
    expect(beats.state.playerStatus.control).toBe("downed");
    expect(beats.state.playerStatus.tags).toContain("vale_assault");
    expect(beats.state.evidenceIds).not.toContain("brass-key");
    expect(beats.state.evidenceIds).toContain("vale-letter");
    expect(beats.state.locationId).toBe("entrance-hall");
  });

  it("after midnight without active retaliation ends as time_expired", () => {
    let state = createInitialPlaythrough(def, "test-time-fail");
    state = {
      ...state,
      time: {
        slotId: "after_midnight",
        minutesFromStart: 160,
        reachedSlotIdsThisTurn: ["after_midnight"],
      },
      clocks: {},
    };
    const beats = evaluateBeats(def, state, 3);
    expect(beats.fired).toContain("failure_time_runs_out");
    expect(beats.state.status).toBe("denouement");
    expect(beats.state.endingId).toBe("failure_time_expired");
    expect(beats.state.characterState.vale?.willingness).toBe("fled");
  });

  it("professional inquiry clock ends case as arrested", () => {
    let state = createInitialPlaythrough(def, "test-arrested");
    state = {
      ...state,
      clocks: { professional_inquiry: 0 },
    };
    const beats = evaluateBeats(def, state, 3);
    expect(beats.fired).toContain("failure_arrested");
    expect(beats.state.status).toBe("denouement");
    expect(beats.state.endingId).toBe("failure_arrested");
  });

  it("does not fire further failure beats after case already failed", () => {
    let state = createInitialPlaythrough(def, "test-no-double-fail");
    state = {
      ...state,
      status: "failed",
      endingId: "failure_wrong_accusation",
      clocks: { vale_retaliation: 0, professional_inquiry: 0 },
      time: {
        slotId: "after_midnight",
        minutesFromStart: 200,
        reachedSlotIdsThisTurn: [],
      },
    };
    const beats = evaluateBeats(def, state, 3);
    expect(beats.fired).toEqual([]);
  });

  it("passive time can reach midnight beat", () => {
    let state = createInitialPlaythrough(def, "test-time");
    // jump near midnight
    state = {
      ...state,
      time: {
        slotId: "approaching_midnight",
        minutesFromStart: 115,
        reachedSlotIdsThisTurn: [],
      },
      turnCount: 5,
    };
    state = advancePassiveTime(def, state);
    // one more march over 120
    state = {
      ...state,
      time: {
        ...state.time!,
        minutesFromStart: 125,
        reachedSlotIdsThisTurn: ["midnight"],
        slotId: "midnight",
      },
    };
    const beats = evaluateBeats(def, state, 2);
    expect(beats.fired).toContain("midnight_strikes");
    expect(beats.state.environment.light).toBe("night");
  });

  it("director inspect maps to patch", () => {
    const state = createInitialPlaythrough(def, "t1");
    const { patch } = directorIntentsToPatch(
      def,
      state,
      { intents: [{ type: "inspect", targetHint: "broken vase" }] },
      "Examine the broken vase"
    );
    const applied = validateAndApplyPatch(def, state, patch);
    expect(applied.evidenceAdded.length).toBeGreaterThan(0);
  });
});
