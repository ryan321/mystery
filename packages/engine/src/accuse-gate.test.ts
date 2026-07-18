import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import { applyAccuseGate } from "./accuse-gate.js";
import { validateAndApplyPatch } from "./validate-patch.js";
import { affirmativeMention, scoreAccusation } from "./accusation.js";
import { allowedKnowledgeForCharacter } from "./knowledge.js";
import { evaluateBeats } from "./beats.js";

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

describe("affirmativeMention (negation-aware matching)", () => {
  it("counts plain mentions", () => {
    expect(affirmativeMention("vale did it, i am certain", "vale")).toBe(true);
  });

  it("ignores negated mentions in the same sentence", () => {
    expect(affirmativeMention("it wasn't vale", "vale")).toBe(false);
    expect(affirmativeMention("i don't think vale did it", "vale")).toBe(false);
    expect(affirmativeMention("i doubt vale had anything to do with it", "vale")).toBe(false);
    expect(affirmativeMention("vale is innocent", "vale")).toBe(false);
    expect(affirmativeMention("vale didn't do it", "vale")).toBe(false);
  });

  it("scopes negation to the sentence", () => {
    expect(
      affirmativeMention("henshaw was not in the hall. vale did it.", "vale")
    ).toBe(true);
    expect(
      affirmativeMention("vale is innocent. henshaw took the silver.", "henshaw")
    ).toBe(true);
  });
});

describe("negation-aware accusation scoring", () => {
  it("does not solve on an exculpatory mention of the killer", () => {
    const score = scoreAccusation(def, {
      summary: "It wasn't Vale. Henshaw did it for the silverware.",
    });
    expect(score).toBe("failure");
  });

  it("still solves on an affirmative accusation", () => {
    const score = scoreAccusation(def, {
      summary:
        "Vale did it — he struck Blackwood in the hall over the fraud letter.",
    });
    expect(score).toBe("success");
  });
});

describe("accuse confirmation gate", () => {
  const informalPatch = {
    accuse: {
      summary: "Henshaw did it for the silver",
      suspectIds: ["henshaw"],
    },
  };

  it("parks an informal accusation as pending instead of judging", () => {
    const state = createInitialPlaythrough(def, "t-gate-informal");
    const gate = applyAccuseGate(
      def,
      state,
      informalPatch,
      "Henshaw did it for the silver"
    );
    expect(gate.patch.accuse).toBeUndefined();
    expect(gate.state.pendingAccusation?.suspectIds).toEqual(["henshaw"]);
    expect(gate.state.flags.accused_henshaw).toBe(true);
    expect(gate.justHappened.some((j) => j.id === "accusation_pending")).toBe(
      true
    );
    const v = validateAndApplyPatch(def, gate.state, gate.patch);
    expect(v.nextState.status).toBe("active");
  });

  it("confirmation next turn releases the pending accusation for judgment", () => {
    const state = createInitialPlaythrough(def, "t-gate-confirm");
    const gate = applyAccuseGate(
      def,
      state,
      informalPatch,
      "Henshaw did it for the silver"
    );
    const confirm = applyAccuseGate(def, gate.state, {}, "Yes. I'm sure — do it.");
    expect(confirm.patch.accuse?.suspectIds).toEqual(["henshaw"]);
    expect(confirm.state.pendingAccusation).toBeUndefined();

    const judged = validateAndApplyPatch(def, confirm.state, confirm.patch);
    expect(judged.nextState.status).toBe("denouement");
    expect(judged.nextState.resolution?.outcome).toBe("failure");
    // Generic flags replace the old engine hardcode
    expect(judged.nextState.flags.falsely_accused_henshaw).toBe(true);
    expect(judged.nextState.flags.accused_henshaw).toBe(true);
    // Definition-driven reaction still fires from the generic flag
    const beats = evaluateBeats(def, judged.nextState, 3);
    expect(beats.fired).toContain("henshaw_shuts_down");
  });

  it("formal wording bypasses the gate", () => {
    const state = createInitialPlaythrough(def, "t-gate-formal");
    const gate = applyAccuseGate(
      def,
      state,
      {
        accuse: {
          summary:
            "I formally accuse Mr. Vale of killing Blackwood in the hall over the fraud.",
          suspectIds: ["vale"],
          motive: "fraud exposure",
        },
      },
      "I formally accuse Mr. Vale of killing Blackwood in the hall over the fraud."
    );
    expect(gate.patch.accuse).toBeDefined();
    const v = validateAndApplyPatch(def, gate.state, gate.patch);
    expect(v.nextState.status).toBe("denouement");
    expect(v.accusation?.score).toBe("success");
  });

  it("withdrawal clears the pending accusation without judgment", () => {
    const state = createInitialPlaythrough(def, "t-gate-withdraw");
    const gate = applyAccuseGate(
      def,
      state,
      informalPatch,
      "Henshaw did it for the silver"
    );
    const g = applyAccuseGate(def, gate.state, {}, "Never mind — I'm not ready.");
    expect(g.state.pendingAccusation).toBeUndefined();
    expect(g.patch.accuse).toBeUndefined();
    expect(g.justHappened.some((j) => j.id === "accusation_withdrawn")).toBe(
      true
    );
  });

  it("pending accusations expire after pendingTurns", () => {
    const state = createInitialPlaythrough(def, "t-gate-expire");
    const gate = applyAccuseGate(
      def,
      state,
      informalPatch,
      "Henshaw did it for the silver"
    );
    const stale = { ...gate.state, turnCount: 5 };
    const g = applyAccuseGate(def, stale, {}, "yes");
    expect(g.state.pendingAccusation).toBeUndefined();
    expect(g.patch.accuse).toBeUndefined();
  });

  it("naming a different suspect replaces the pending accusation", () => {
    const state = createInitialPlaythrough(def, "t-gate-replace");
    const gate = applyAccuseGate(
      def,
      state,
      informalPatch,
      "Henshaw did it for the silver"
    );
    const g = applyAccuseGate(
      def,
      gate.state,
      { accuse: { summary: "No — it was Vale all along", suspectIds: ["vale"] } },
      "No — it was Vale all along."
    );
    expect(g.patch.accuse).toBeUndefined();
    expect(g.state.pendingAccusation?.suspectIds).toEqual(["vale"]);
  });

  it("respects accusePolicy.requireConfirmation = false", () => {
    const noGateDef = {
      ...def,
      accusePolicy: { requireConfirmation: false, pendingTurns: 3 },
    };
    const state = createInitialPlaythrough(noGateDef, "t-gate-off");
    const gate = applyAccuseGate(
      noGateDef,
      state,
      informalPatch,
      "Henshaw did it for the silver"
    );
    expect(gate.patch.accuse).toBeDefined();
  });
});

describe("opaque withheld knowledge", () => {
  it("does not leak beat ids into mustNotReveal", () => {
    const state = createInitialPlaythrough(def, "t-opaque");
    const { mustNotReveal } = allowedKnowledgeForCharacter(
      def,
      state,
      "henshaw"
    );
    const joined = mustNotReveal.join(" ");
    expect(joined).not.toMatch(/henshaw-saw-vale-earlier|henshaw-who-home/);
    expect(mustNotReveal.some((l) => /undisclosed fact/.test(l))).toBe(true);
  });
});
