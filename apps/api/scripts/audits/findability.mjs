/**
 * Fact-findability audit — fully deterministic.
 *
 * The deductions audit checks each support's leaf is reachable in isolation.
 * This audit asks the harder, player-facing question: for EACH rubric fact
 * (identity / method / motive / …), can the player actually ASSEMBLE it —
 * satisfy the terminal node's `requires` chain AND `minSupports` — using only
 * clues that are reachable given the case's gating? And is that trail robust,
 * or does the whole fact collapse if the player misses one clue (a single
 * point of failure, including a hidden prerequisite bottleneck several nodes
 * deep that per-support checks never see)?
 *
 * Method: build the reachable evidence/knowledge/flag set (computeReachability),
 * run the engine's own node-resolution fixpoint, then for each fact remove one
 * contributing clue at a time and re-resolve. A clue whose removal blocks the
 * fact is a chokepoint; a chokepoint that isn't in solution.criticalEvidenceIds
 * is a fragility the author may not have intended.
 *
 * See docs/INVESTIGATION_MODEL.md (three-clue rule) and CREATING_MYSTERIES.md.
 */
import { gradeOf } from "./shared.mjs";
import { computeReachability } from "./clues.mjs";

function knowledgeBeats(c) {
  return [...(c.knowledge?.private ?? []), ...(c.knowledge?.secrets ?? [])];
}

/** requiresFlags is an object { flagId: boolean }. */
function flagsSatisfied(req, flags) {
  if (!req) return true;
  return Object.entries(req).every(([k, v]) => (v ? flags.has(k) : !flags.has(k)));
}

/** Knowledge beats the player can obtain given a reachable evidence/flag set. */
function reachableKnowledge(def, evSet, flags) {
  const out = new Set();
  for (const c of def.characters) {
    for (const b of knowledgeBeats(c)) {
      const evOk = (b.requiresEvidenceIds ?? []).every((id) => evSet.has(id));
      if (evOk && flagsSatisfied(b.requiresFlags, flags)) out.add(`${c.id}/${b.id}`);
    }
  }
  return out;
}

/** Best-effort optimistic evaluation of a `condition` support. */
function conditionMaybe(cond, flags, evSet) {
  if (!cond || typeof cond !== "object") return false;
  switch (cond.type) {
    case "has_evidence":
      return evSet.has(cond.evidenceId);
    case "game_flag":
    case "flag":
      return cond.value === false ? !flags.has(cond.id) : flags.has(cond.id);
    case "all":
      return (cond.conditions ?? []).every((c) => conditionMaybe(c, flags, evSet));
    case "any":
      return (cond.conditions ?? []).some((c) => conditionMaybe(c, flags, evSet));
    default:
      // visited / presented / time-based / etc. — assume reachable (optimistic)
      return true;
  }
}

function supportSatisfied(s, resolved, evSet, knowSet, flags) {
  if (s.evidenceId) return evSet.has(s.evidenceId);
  if (s.nodeId) return resolved.has(s.nodeId);
  if (s.knowledge) return knowSet.has(`${s.knowledge.characterId}/${s.knowledge.beatId}`);
  if (s.condition) return conditionMaybe(s.condition, flags, evSet);
  return false;
}

/** Engine-parity fixpoint: a node resolves when all `requires` resolve and
 *  ≥ minSupports supports are satisfied. */
function resolveAll(nodes, evSet, knowSet, flags) {
  const resolved = new Set();
  let changed = true;
  let guard = nodes.length + 2;
  while (changed && guard-- > 0) {
    changed = false;
    for (const n of nodes) {
      if (resolved.has(n.id)) continue;
      if (!(n.requires ?? []).every((r) => resolved.has(r))) continue;
      const supports = n.supports ?? [];
      if (!supports.length) continue;
      let count = 0;
      for (const s of supports) {
        if (supportSatisfied(s, resolved, evSet, knowSet, flags)) count += 1;
      }
      if (count >= (n.minSupports ?? 1)) {
        resolved.add(n.id);
        changed = true;
      }
    }
  }
  return resolved;
}

/** Evidence + knowledge that participate anywhere under a terminal —
 *  following BOTH `requires` prerequisites and `nodeId` supports, so hidden
 *  bottlenecks deep in the chain are included. */
function subtreeLeaves(nodeId, byId) {
  const ev = new Set();
  const know = new Set();
  const seen = new Set();
  const walk = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const n = byId.get(id);
    if (!n) return;
    for (const r of n.requires ?? []) walk(r);
    for (const s of n.supports ?? []) {
      if (s.evidenceId) ev.add(s.evidenceId);
      if (s.nodeId) walk(s.nodeId);
      if (s.knowledge) know.add(`${s.knowledge.characterId}/${s.knowledge.beatId}`);
    }
  };
  walk(nodeId);
  return { ev, know };
}

export async function runFindabilityAudit(def) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });

  const nodes = def.deductions ?? [];
  const rubricFacts = def.solution?.rubric?.requiredFacts ?? [];

  if (!nodes.length) {
    checks.push({
      check: "graph_present",
      verdict: "warn",
      note: "no deductions[] — findability not modeled",
    });
    return { audit: "findability", grade: gradeOf(checks, findings), checks, findings, stats: {} };
  }
  if (!rubricFacts.length) {
    checks.push({
      check: "rubric_present",
      verdict: "warn",
      note: "no rubric.requiredFacts — nothing to check findability against",
    });
    return { audit: "findability", grade: gradeOf(checks, findings), checks, findings, stats: {} };
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const critical = new Set(def.solution?.criticalEvidenceIds ?? []);

  // evidence id → its location (for trail-spread)
  const evLoc = new Map();
  for (const e of def.evidence ?? []) {
    if (e.discoverableAt?.locationId) evLoc.set(e.id, e.discoverableAt.locationId);
  }
  for (const l of def.locations) {
    for (const insp of l.inspectables ?? []) {
      for (const eid of insp.onInspect?.revealsEvidenceIds ?? []) {
        if (!evLoc.has(eid)) evLoc.set(eid, l.id);
      }
    }
  }

  const reach = computeReachability(def);
  const flags = reach.flags;
  const evAll = reach.evidence;
  const knowAll = reachableKnowledge(def, evAll, flags);
  const resolvedAll = resolveAll(nodes, evAll, knowAll, flags);

  const perFact = [];
  for (const fact of rubricFacts) {
    const role = fact.role ?? "supporting";
    const terms = nodes.filter((n) => n.factId === fact.id);
    if (!terms.length) {
      perFact.push({ id: fact.id, role, hasNode: false });
      continue;
    }
    const findable = terms.some((t) => resolvedAll.has(t.id));

    const leaves = { ev: new Set(), know: new Set() };
    for (const t of terms) {
      const l = subtreeLeaves(t.id, byId);
      for (const e of l.ev) leaves.ev.add(e);
      for (const k of l.know) leaves.know.add(k);
    }
    const contributing = [...leaves.ev].filter((e) => evAll.has(e));

    const chokepoints = [];
    if (findable) {
      for (const e of contributing) {
        const evMinus = new Set(evAll);
        evMinus.delete(e);
        const knowMinus = reachableKnowledge(def, evMinus, flags);
        const res = resolveAll(nodes, evMinus, knowMinus, flags);
        if (!terms.some((t) => res.has(t.id))) chokepoints.push(e);
      }
    }
    const locations = [...new Set(contributing.map((e) => evLoc.get(e)).filter(Boolean))];
    perFact.push({
      id: fact.id,
      role,
      hasNode: true,
      findable,
      contributing,
      chokepoints,
      locations,
      terminals: terms.map((t) => t.id),
    });
  }

  // ── every fact with a node resolves from reachable clues ──────────────
  const withNode = perFact.filter((f) => f.hasNode);
  const noNode = perFact.filter((f) => !f.hasNode);
  const unfindable = withNode.filter((f) => !f.findable);
  const summary = perFact
    .map((f) => {
      if (!f.hasNode) return `${f.id}:no-node`;
      if (!f.findable) return `${f.id}:UNFINDABLE`;
      const rob = f.chokepoints.length
        ? `${f.chokepoints.length} chokepoint${f.chokepoints.length > 1 ? "s" : ""}`
        : "robust";
      return `${f.id}:${rob} (${f.contributing.length} clue${f.contributing.length === 1 ? "" : "s"}/${f.locations.length} loc)`;
    })
    .join(" · ");
  checks.push({
    check: "facts_findable",
    verdict: unfindable.length ? "fail" : "pass",
    note: unfindable.length
      ? `unassemblable from reachable clues: ${unfindable.map((f) => f.id).join(", ")}  ·  ${summary}`
      : summary,
  });
  for (const f of unfindable) {
    note(
      "high",
      `fact "${f.id}" (${f.role}) has a terminal node but it never resolves even with every discoverable clue — the player cannot prove it`
    );
  }
  for (const f of noNode) {
    note(
      f.role === "supporting" ? "info" : "medium",
      `fact "${f.id}" (${f.role}) has no terminal deduction node — findability is not modeled by the graph`
    );
  }

  // ── robustness: no fact hinges on a single, non-critical clue ─────────
  const fragile = withNode.filter(
    (f) => f.findable && f.chokepoints.some((e) => !critical.has(e))
  );
  const anyChokes = withNode.some((f) => f.findable && f.chokepoints.length);
  checks.push({
    check: "facts_robust",
    verdict: fragile.length ? "warn" : "pass",
    note: fragile.length
      ? `single missable clue can block: ${fragile
          .map((f) => `${f.id}←${f.chokepoints.filter((e) => !critical.has(e)).join("/")}`)
          .join("; ")}`
      : anyChokes
        ? "no fact hinges on a non-critical single clue (some funnel through critical-path clues — expected)"
        : "every fact has ≥2 independent evidence paths",
  });
  for (const f of withNode) {
    if (!f.findable) continue;
    for (const e of f.chokepoints) {
      const isCrit = critical.has(e);
      const sev = isCrit ? "info" : f.role === "supporting" ? "info" : "medium";
      note(
        sev,
        `fact "${f.id}" (${f.role}) hinges on the single clue "${e}"${
          isCrit
            ? " [critical — an expected linchpin]"
            : " [NOT marked critical — a player who misses it cannot prove this fact; add a second path or mark it critical]"
        }`
      );
    }
  }

  // ── trail not concentrated in one room ───────────────────────────────
  const concentrated = withNode.filter(
    (f) => f.findable && f.contributing.length >= 2 && f.locations.length === 1
  );
  checks.push({
    check: "fact_trail_spread",
    verdict: concentrated.length ? "warn" : "pass",
    note: concentrated.length
      ? `all clues in one room: ${concentrated.map((f) => `${f.id}@${f.locations[0]}`).join(", ")}`
      : "each fact's clues span ≥2 locations (or resolve on a single clue)",
  });
  for (const f of concentrated) {
    note(
      "medium",
      `fact "${f.id}" (${f.role}) draws all ${f.contributing.length} of its clues from one room (${f.locations[0]}) — a single missed sweep loses the whole fact`
    );
  }

  return {
    audit: "findability",
    grade: gradeOf(checks, findings),
    checks,
    findings,
    stats: {
      facts: withNode.map((f) => ({
        id: f.id,
        role: f.role,
        findable: f.findable,
        clues: f.contributing,
        chokepoints: f.chokepoints,
        locations: f.locations,
        terminals: f.terminals,
      })),
    },
  };
}
