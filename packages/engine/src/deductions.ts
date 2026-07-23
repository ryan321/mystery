/**
 * Deduction-graph derivation — the player-facing projection of the SEALED
 * `def.deductions` graph (docs/INVESTIGATION_MODEL.md §3).
 *
 * The graph itself never leaves the engine. This module turns it into
 * spoiler-safe surfaces: open/resolved LEADS (question text only), a coarse
 * READINESS-to-accuse signal, a CASEBOOK projection, and Help auto-checks.
 *
 * Nothing here gates solving — cold accusations stay allowed. This guides and
 * measures; it is never a permission check.
 */

import type {
  Condition,
  DeductionNode,
  DeductionSupport,
  MysteryDefinition,
  PlaythroughState,
} from "@mystery/shared";
import { evaluateCondition } from "./conditions.js";
import { characterKnown, isLocationKnown } from "./identity.js";

export type LeadStatus = "open" | "resolved";

export type Lead = {
  id: string;
  /** Player-facing question text — the ONLY graph text that surfaces. */
  question: string;
  status: LeadStatus;
  /** Terminal facet when this node ties to a rubric fact; else "lead". */
  facet: "identity" | "method" | "motive" | "supporting" | "lead";
};

export type Readiness = {
  identity: boolean;
  method: boolean;
  motive: boolean;
  facetsReady: number;
  facetsTotal: number;
  /** Coarse, diegetic label — never a solve score. */
  label: string;
};

export type HelpProgress = {
  /** Every location the player KNOWS OF has been visited. */
  exploredKnownLocations: boolean;
  /** Every talkable character the player has met/known has been questioned. */
  talkedToEveryoneKnown: boolean;
};

/**
 * Casebook — derived only from state the player legitimately has.
 * Never restates answers; resolved leads mark closed questions only.
 */
export type Casebook = {
  openLeads: { id: string; question: string }[];
  resolvedLeads: { id: string; question: string }[];
  /** What you've learned — held items + disclosed knowledge (no author secrets). */
  cluesNoted: { id: string; label: string; kind: "item" | "testimony" }[];
};

export type Investigation = {
  leads: Lead[];
  openCount: number;
  resolvedCount: number;
  readiness: Readiness;
  help: HelpProgress;
  casebook: Casebook;
};

/** Facet of a node: from rubric fact when factId set, else role, else lead. */
export function nodeFacet(
  def: MysteryDefinition,
  node: DeductionNode
): Lead["facet"] {
  if (node.factId) {
    const fact = def.solution.rubric.requiredFacts.find(
      (f) => f.id === node.factId
    );
    if (fact?.role === "identity") return "identity";
    if (fact?.role === "method") return "method";
    if (fact?.role === "motive") return "motive";
    if (fact?.role === "supporting") return "supporting";
  }
  if (
    node.role === "identity" ||
    node.role === "method" ||
    node.role === "motive" ||
    node.role === "supporting"
  ) {
    return node.role;
  }
  return "lead";
}

function supportSatisfied(
  def: MysteryDefinition,
  state: PlaythroughState,
  s: DeductionSupport,
  resolved: ReadonlySet<string>
): boolean {
  if ("evidenceId" in s) return state.evidenceIds.includes(s.evidenceId);
  if ("nodeId" in s) return resolved.has(s.nodeId);
  if ("knowledge" in s) {
    const mem = state.characterMemory[s.knowledge.characterId];
    return !!mem && mem.revealedBeatIds.includes(s.knowledge.beatId);
  }
  if ("condition" in s) {
    return evaluateCondition(def, state, s.condition as Condition);
  }
  return false;
}

function nodeResolvable(
  def: MysteryDefinition,
  state: PlaythroughState,
  node: DeductionNode,
  resolved: ReadonlySet<string>
): boolean {
  if (!node.requires.every((r) => resolved.has(r))) return false;
  if (node.supports.length === 0) return false;
  let count = 0;
  for (const s of node.supports) {
    if (supportSatisfied(def, state, s, resolved)) {
      count += 1;
      if (count >= node.minSupports) return true;
    }
  }
  return count >= node.minSupports;
}

/**
 * Fixpoint over the DAG: a node resolves when its `requires` are resolved and
 * ≥ minSupports supports are satisfied (a support may itself be a prior node).
 */
export function resolveDeductions(
  def: MysteryDefinition,
  state: PlaythroughState
): Set<string> {
  const resolved = new Set<string>();
  let changed = true;
  let guard = def.deductions.length + 1;
  while (changed && guard-- > 0) {
    changed = false;
    for (const node of def.deductions) {
      if (resolved.has(node.id)) continue;
      if (nodeResolvable(def, state, node, resolved)) {
        resolved.add(node.id);
        changed = true;
      }
    }
  }
  return resolved;
}

function nodeOpened(
  def: MysteryDefinition,
  state: PlaythroughState,
  node: DeductionNode,
  resolved: ReadonlySet<string>
): boolean {
  if (node.opensWhen) {
    return evaluateCondition(def, state, node.opensWhen as Condition);
  }
  return node.requires.every((r) => resolved.has(r));
}

function readinessLabel(
  identity: boolean,
  facetsReady: number,
  facetsTotal: number
): string {
  if (!identity) return "No one to name with confidence yet";
  if (facetsTotal <= 1) return "You could make an accusation";
  if (facetsReady >= facetsTotal) return "You have a case that would hold";
  return "You can name a suspect — but not yet prove the how and why";
}

function computeReadiness(
  def: MysteryDefinition,
  resolved: ReadonlySet<string>
): Readiness {
  const present = { identity: false, method: false, motive: false };
  const ready = { identity: false, method: false, motive: false };
  for (const node of def.deductions) {
    const facet = nodeFacet(def, node);
    if (facet === "identity" || facet === "method" || facet === "motive") {
      present[facet] = true;
      if (resolved.has(node.id)) ready[facet] = true;
    }
  }
  const facetsTotal =
    Number(present.identity) + Number(present.method) + Number(present.motive);
  const facetsReady =
    Number(ready.identity) + Number(ready.method) + Number(ready.motive);
  return {
    identity: ready.identity,
    method: ready.method,
    motive: ready.motive,
    facetsReady,
    facetsTotal,
    label: readinessLabel(ready.identity, facetsReady, facetsTotal),
  };
}

function computeHelp(
  def: MysteryDefinition,
  state: PlaythroughState
): HelpProgress {
  const known = def.locations.filter((l) => isLocationKnown(state, l.id));
  const exploredKnownLocations =
    known.length > 0 &&
    known.every((l) => state.visitedLocationIds.includes(l.id));

  const knownCast = def.characters.filter(
    (c) => c.storyRole !== "victim" && characterKnown(def, state, c.id)
  );
  const talkedToEveryoneKnown =
    knownCast.length > 0 &&
    knownCast.every((c) => (state.characterState[c.id]?.timesTalked ?? 0) > 0);

  return { exploredKnownLocations, talkedToEveryoneKnown };
}

function computeCasebook(
  def: MysteryDefinition,
  state: PlaythroughState,
  leads: Lead[]
): Casebook {
  const openLeads = leads
    .filter((l) => l.status === "open")
    .map((l) => ({ id: l.id, question: l.question }));
  const resolvedLeads = leads
    .filter((l) => l.status === "resolved")
    .map((l) => ({ id: l.id, question: l.question }));

  const cluesNoted: Casebook["cluesNoted"] = [];
  for (const id of state.evidenceIds) {
    const item = def.evidence.find((e) => e.id === id);
    cluesNoted.push({
      id: `item:${id}`,
      label: item?.name ?? id,
      kind: "item",
    });
  }
  for (const [cid, mem] of Object.entries(state.characterMemory)) {
    const ch = def.characters.find((c) => c.id === cid);
    for (const beatId of mem.revealedBeatIds) {
      const beat = [
        ...(ch?.knowledge.private ?? []),
        ...(ch?.knowledge.secrets ?? []),
      ].find((b) => b.id === beatId);
      cluesNoted.push({
        id: `testimony:${cid}:${beatId}`,
        label: beat
          ? `${ch?.name ?? cid}: ${beat.content.slice(0, 80)}${
              beat.content.length > 80 ? "…" : ""
            }`
          : `${ch?.name ?? cid} disclosed something`,
        kind: "testimony",
      });
    }
  }

  return { openLeads, resolvedLeads, cluesNoted };
}

/**
 * Spoiler-safe investigation projection for the player UI (Casebook +
 * readiness + Help). Safe to send to the client.
 */
export function computeInvestigation(
  def: MysteryDefinition,
  state: PlaythroughState
): Investigation {
  const resolved = resolveDeductions(def, state);
  const leads: Lead[] = [];
  for (const node of def.deductions) {
    if (!nodeOpened(def, state, node, resolved)) continue;
    leads.push({
      id: node.id,
      question: node.question,
      status: resolved.has(node.id) ? "resolved" : "open",
      facet: nodeFacet(def, node),
    });
  }
  const openCount = leads.filter((l) => l.status === "open").length;
  const resolvedCount = leads.length - openCount;
  return {
    leads,
    openCount,
    resolvedCount,
    readiness: computeReadiness(def, resolved),
    help: computeHelp(def, state),
    casebook: computeCasebook(def, state, leads),
  };
}
