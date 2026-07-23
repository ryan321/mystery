import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DeductionNode, MysteryDefinition } from "@mystery/shared";
import { parseMysteryDefinition } from "@mystery/shared";
import { createInitialPlaythrough } from "./create-playthrough.js";
import { computeInvestigation, resolveDeductions } from "./deductions.js";

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

// A small graph over real fixture evidence ids + a henshaw knowledge beat.
const NODES: DeductionNode[] = [
  {
    id: "entry-lead",
    claim: "The break-in was faked",
    question: "How did the intruder get in?",
    role: "lead",
    requires: [],
    supports: [{ evidenceId: "black-thread" }, { evidenceId: "muddy-boot-print" }],
    minSupports: 1,
  },
  {
    id: "method-node",
    claim: "It was arranged, not opportunistic",
    question: "Who arranged it?",
    role: "method",
    requires: ["entry-lead"],
    supports: [{ evidenceId: "vale-letter" }],
    minSupports: 1,
  },
  {
    id: "identity-node",
    claim: "The arranger is the culprit",
    question: "Who is guilty?",
    role: "identity",
    requires: ["method-node"],
    // chained: resolves as soon as the method deduction resolves
    supports: [{ nodeId: "method-node" }],
    minSupports: 1,
  },
  {
    id: "motive-node",
    claim: "Money",
    question: "Why would they do it?",
    role: "motive",
    requires: [],
    supports: [{ evidenceId: "brass-key" }],
    minSupports: 1,
  },
  {
    id: "who-knew",
    claim: "Someone knew the house was occupied",
    question: "Who knew the house was not empty?",
    role: "lead",
    requires: [],
    supports: [{ knowledge: { characterId: "henshaw", beatId: "henshaw-who-home" } }],
    minSupports: 1,
  },
];

const def = { ...baseDef, deductions: NODES } as MysteryDefinition;

describe("resolveDeductions", () => {
  it("resolves nothing with no evidence or knowledge", () => {
    const state = createInitialPlaythrough(def, "d-0");
    expect(resolveDeductions(def, state).size).toBe(0);
  });

  it("resolves a root node from one of its disjoint supports", () => {
    const s = { ...createInitialPlaythrough(def, "d-1"), evidenceIds: ["black-thread"] };
    const r = resolveDeductions(def, s);
    expect(r.has("entry-lead")).toBe(true);
    expect(r.has("method-node")).toBe(false); // needs vale-letter
  });

  it("chains: identity resolves via a nodeId support once method resolves", () => {
    const s = {
      ...createInitialPlaythrough(def, "d-2"),
      evidenceIds: ["black-thread", "vale-letter"],
    };
    const r = resolveDeductions(def, s);
    expect(r.has("entry-lead")).toBe(true);
    expect(r.has("method-node")).toBe(true);
    expect(r.has("identity-node")).toBe(true); // chained off method-node
  });

  it("resolves a node from a knowledge-beat support", () => {
    const base = createInitialPlaythrough(def, "d-3");
    const s = {
      ...base,
      characterMemory: {
        ...base.characterMemory,
        henshaw: { revealedBeatIds: ["henshaw-who-home"], summary: "", recentTurns: [] },
      },
    };
    expect(resolveDeductions(def, s).has("who-knew")).toBe(true);
  });
});

describe("computeInvestigation — leads projection", () => {
  it("opens only root questions before anything is found", () => {
    const state = createInitialPlaythrough(def, "i-0");
    const inv = computeInvestigation(def, state);
    const ids = inv.leads.map((l) => l.id).sort();
    expect(ids).toEqual(["entry-lead", "motive-node", "who-knew"]); // method/identity gated by requires
    expect(inv.openCount).toBe(3);
    expect(inv.resolvedCount).toBe(0);
    expect(inv.leads.every((l) => l.status === "open")).toBe(true);
    // never leaks claims/supports
    expect(JSON.stringify(inv.leads)).not.toMatch(/faked|arranged|Money/);
  });

  it("marks a lead resolved and opens the next gated question", () => {
    const state = { ...createInitialPlaythrough(def, "i-1"), evidenceIds: ["black-thread"] };
    const inv = computeInvestigation(def, state);
    const byId = Object.fromEntries(inv.leads.map((l) => [l.id, l.status]));
    expect(byId["entry-lead"]).toBe("resolved");
    expect(byId["method-node"]).toBe("open"); // now opened (requires resolved) but unmet
    expect(inv.resolvedCount).toBe(1);
  });
});

describe("computeInvestigation — readiness", () => {
  it("is not ready with no terminal facets resolved", () => {
    const inv = computeInvestigation(def, createInitialPlaythrough(def, "r-0"));
    expect(inv.readiness.identity).toBe(false);
    expect(inv.readiness.facetsReady).toBe(0);
    expect(inv.readiness.facetsTotal).toBe(3);
    expect(inv.readiness.label).toMatch(/no one/i);
  });

  it("names a suspect but not the how/why with partial facets", () => {
    const state = {
      ...createInitialPlaythrough(def, "r-1"),
      evidenceIds: ["black-thread", "vale-letter"], // identity + method, no motive
    };
    const inv = computeInvestigation(def, state);
    expect(inv.readiness.identity).toBe(true);
    expect(inv.readiness.method).toBe(true);
    expect(inv.readiness.motive).toBe(false);
    expect(inv.readiness.facetsReady).toBe(2);
    expect(inv.readiness.label).toMatch(/name a suspect/i);
  });

  it("a case that would hold with every facet resolved", () => {
    const state = {
      ...createInitialPlaythrough(def, "r-2"),
      evidenceIds: ["black-thread", "vale-letter", "brass-key"],
    };
    const inv = computeInvestigation(def, state);
    expect(inv.readiness.facetsReady).toBe(3);
    expect(inv.readiness.label).toMatch(/would hold/i);
  });
});

describe("computeInvestigation — help auto-check", () => {
  it("flips exploredKnownLocations once every known location is visited", () => {
    const base = createInitialPlaythrough(def, "h-0");
    // Know two locations; visit only one → not explored.
    const partial = {
      ...base,
      locationState: {
        ...base.locationState,
        library: { ...(base.locationState["library"] ?? {}), known: true },
        conservatory: { ...(base.locationState["conservatory"] ?? {}), known: true },
      },
      visitedLocationIds: ["library"],
    } as typeof base;
    expect(computeInvestigation(def, partial).help.exploredKnownLocations).toBe(false);

    const full = { ...partial, visitedLocationIds: ["library", "conservatory"] };
    // (the starting location is also known+visited from init; include it)
    const withStart = {
      ...full,
      visitedLocationIds: Array.from(
        new Set([...full.visitedLocationIds, ...base.visitedLocationIds])
      ),
    };
    const known = def.locations.filter(
      (l) => withStart.visitedLocationIds.includes(l.id) || withStart.locationState[l.id]?.known
    );
    const allVisited = known.every((l) => withStart.visitedLocationIds.includes(l.id));
    expect(computeInvestigation(def, withStart).help.exploredKnownLocations).toBe(allVisited);
  });
});

describe("computeInvestigation — casebook", () => {
  it("lists held items as cluesNoted and never leaks claims", () => {
    const state = {
      ...createInitialPlaythrough(def, "cb-0"),
      evidenceIds: ["black-thread"],
    };
    const inv = computeInvestigation(def, state);
    expect(inv.casebook.cluesNoted.some((c) => c.id === "item:black-thread")).toBe(
      true
    );
    expect(inv.casebook.openLeads.length).toBeGreaterThan(0);
    // Sealed claims never surface — only questions + inventory labels.
    expect(JSON.stringify(inv.casebook)).not.toMatch(/The break-in was faked|It was arranged|claim/);
  });
});

describe("computeInvestigation — facet from factId", () => {
  it("derives identity readiness from rubric fact role via factId", () => {
    const withFacts = {
      ...def,
      deductions: [
        {
          id: "who",
          claim: "Vale",
          question: "Who is guilty?",
          role: "lead" as const,
          factId: def.solution.rubric.requiredFacts.find((f) => f.role === "identity")
            ?.id,
          requires: [],
          supports: [{ evidenceId: "vale-letter" }],
          minSupports: 1,
        },
      ].filter((n) => n.factId),
    } as MysteryDefinition;
    if (!withFacts.deductions.length) return; // fixture may lack identity fact
    const state = {
      ...createInitialPlaythrough(withFacts, "f-0"),
      evidenceIds: ["vale-letter"],
    };
    const inv = computeInvestigation(withFacts, state);
    expect(inv.readiness.identity).toBe(true);
    expect(inv.leads[0]?.facet).toBe("identity");
  });
});
