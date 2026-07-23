/**
 * Solution-graph (deductions) audit — fully deterministic.
 *
 * Fair-play spine: terminals, dual supports, reachable leaves, knowledge
 * gates, DAG integrity, alignment with rubric factIds.
 *
 * See docs/INVESTIGATION_MODEL.md and docs/CREATING_MYSTERIES.md.
 */
import { gradeOf } from "./shared.mjs";
import { computeReachability } from "./clues.mjs";

function knowledgeBeats(c) {
  return [...(c.knowledge?.private ?? []), ...(c.knowledge?.secrets ?? [])];
}

function supportKind(s) {
  if (s.evidenceId) return "evidence";
  if (s.nodeId) return "node";
  if (s.knowledge) return "knowledge";
  if (s.condition) return "condition";
  return "unknown";
}

/** Collect leaf evidence/knowledge reachable as supports under a node (1-hop + nodeId expand). */
function expandLeaves(nodeId, byId, seen = new Set()) {
  if (seen.has(nodeId)) return { evidence: new Set(), knowledge: new Set() };
  seen.add(nodeId);
  const n = byId.get(nodeId);
  const evidence = new Set();
  const knowledge = new Set();
  if (!n) return { evidence, knowledge };
  for (const s of n.supports ?? []) {
    if (s.evidenceId) evidence.add(s.evidenceId);
    if (s.knowledge) {
      knowledge.add(`${s.knowledge.characterId}/${s.knowledge.beatId}`);
    }
    if (s.nodeId) {
      const sub = expandLeaves(s.nodeId, byId, seen);
      for (const e of sub.evidence) evidence.add(e);
      for (const k of sub.knowledge) knowledge.add(k);
    }
  }
  return { evidence, knowledge };
}

export async function runDeductionsAudit(def) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });

  const nodes = def.deductions ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const evidenceIds = new Set(def.evidence.map((e) => e.id));
  const rubricFacts = def.solution?.rubric?.requiredFacts ?? [];
  const rubricById = new Map(rubricFacts.map((f) => [f.id, f]));
  const charById = new Map(def.characters.map((c) => [c.id, c]));

  // ── Empty graph ──────────────────────────────────────────────────────
  if (!nodes.length) {
    checks.push({
      check: "graph_present",
      verdict: "warn",
      note: "no deductions[] — fair-play path lives only in author head (ok for legacy cases)",
    });
    return {
      audit: "deductions",
      grade: gradeOf(checks, findings),
      checks,
      findings,
      stats: { nodes: 0 },
    };
  }
  checks.push({
    check: "graph_present",
    verdict: "pass",
    note: `${nodes.length} deduction nodes`,
  });

  // ── Integrity ────────────────────────────────────────────────────────
  const dups = nodes.filter((n, i) => nodes.findIndex((x) => x.id === n.id) !== i);
  if (dups.length) {
    note("high", `duplicate node ids: ${[...new Set(dups.map((n) => n.id))].join(", ")}`);
  }

  const refProblems = [];
  for (const n of nodes) {
    if (!n.question?.trim()) refProblems.push(`${n.id}: empty question`);
    if (!n.claim?.trim()) refProblems.push(`${n.id}: empty claim`);
    if ((n.minSupports ?? 1) > (n.supports ?? []).length) {
      refProblems.push(
        `${n.id}: minSupports ${n.minSupports} > supports.length ${(n.supports ?? []).length}`
      );
    }
    for (const r of n.requires ?? []) {
      if (!byId.has(r)) refProblems.push(`${n.id}: requires unknown "${r}"`);
    }
    if (n.factId && !rubricById.has(n.factId)) {
      refProblems.push(`${n.id}: factId "${n.factId}" not in rubric.requiredFacts`);
    }
    for (const s of n.supports ?? []) {
      if (s.evidenceId && !evidenceIds.has(s.evidenceId)) {
        refProblems.push(`${n.id}: unknown evidence "${s.evidenceId}"`);
      }
      if (s.nodeId) {
        if (!byId.has(s.nodeId))
          refProblems.push(`${n.id}: support nodeId unknown "${s.nodeId}"`);
        if (s.nodeId === n.id)
          refProblems.push(`${n.id}: self-support via nodeId`);
      }
      if (s.knowledge) {
        const ch = charById.get(s.knowledge.characterId);
        if (!ch) {
          refProblems.push(
            `${n.id}: knowledge character unknown "${s.knowledge.characterId}"`
          );
        } else {
          const beats = knowledgeBeats(ch);
          if (!beats.some((b) => b.id === s.knowledge.beatId)) {
            refProblems.push(
              `${n.id}: unknown beat "${s.knowledge.beatId}" on ${s.knowledge.characterId}`
            );
          }
        }
      }
      if (supportKind(s) === "unknown") {
        refProblems.push(`${n.id}: support object has no evidenceId/nodeId/knowledge/condition`);
      }
    }
  }
  checks.push({
    check: "graph_integrity",
    verdict: refProblems.length || dups.length ? "fail" : "pass",
    note: refProblems.slice(0, 8).join("; ") || "ids, refs, minSupports ok",
  });
  for (const p of refProblems.slice(8)) note("high", p);

  // ── DAG on requires + nodeId supports ────────────────────────────────
  {
    const WHITE = 0,
      GRAY = 1,
      BLACK = 2;
    const color = new Map();
    let cyclic = false;
    const deps = (id) => {
      const n = byId.get(id);
      if (!n) return [];
      const out = [...(n.requires ?? [])];
      for (const s of n.supports ?? []) if (s.nodeId) out.push(s.nodeId);
      return out;
    };
    const visit = (id) => {
      color.set(id, GRAY);
      for (const r of deps(id)) {
        if (!byId.has(r)) continue;
        const c = color.get(r) ?? WHITE;
        if (c === GRAY) {
          cyclic = true;
          return;
        }
        if (c === WHITE) visit(r);
      }
      color.set(id, BLACK);
    };
    for (const n of nodes) {
      if ((color.get(n.id) ?? WHITE) === WHITE) visit(n.id);
      if (cyclic) break;
    }
    checks.push({
      check: "graph_is_dag",
      verdict: cyclic ? "fail" : "pass",
      note: cyclic
        ? "cycle in requires/nodeId edges"
        : "requires + nodeId supports form a DAG",
    });
  }

  // ── Terminals ────────────────────────────────────────────────────────
  const terminals = nodes.filter(
    (n) =>
      n.factId ||
      n.role === "identity" ||
      n.role === "method" ||
      n.role === "motive"
  );
  const byRole = { identity: [], method: [], motive: [] };
  for (const n of terminals) {
    let role = n.role;
    if (n.factId && rubricById.get(n.factId)?.role) {
      role = rubricById.get(n.factId).role;
    }
    if (role === "identity" || role === "method" || role === "motive") {
      byRole[role].push(n.id);
    }
  }
  const missingRoles = ["identity", "method", "motive"].filter(
    (r) => byRole[r].length === 0
  );
  checks.push({
    check: "terminals_cover_facets",
    verdict: missingRoles.length ? "warn" : "pass",
    note: missingRoles.length
      ? `no terminal for: ${missingRoles.join(", ")}`
      : `terminals identity=${byRole.identity.length} method=${byRole.method.length} motive=${byRole.motive.length}`,
  });

  const rubricWithoutNode = rubricFacts.filter(
    (f) =>
      (f.role === "identity" || f.role === "method" || f.role === "motive") &&
      !nodes.some((n) => n.factId === f.id)
  );
  checks.push({
    check: "rubric_facts_have_nodes",
    verdict: rubricWithoutNode.length ? "warn" : "pass",
    note: rubricWithoutNode.length
      ? `rubric facts without deduction node: ${rubricWithoutNode.map((f) => f.id).join(", ")}`
      : "each identity/method/motive rubric fact has a factId node",
  });

  // ── Dual paths (three-clue spirit) ───────────────────────────────────
  const thinTerminals = [];
  for (const n of terminals) {
    const supports = n.supports ?? [];
    const min = n.minSupports ?? 1;
    const kinds = new Set(supports.map(supportKind));
    // Prefer ≥2 supports, or minSupports ≥ 2
    if (supports.length < 2 && min < 2) {
      thinTerminals.push(`${n.id} (only ${supports.length} support(s))`);
    } else if (supports.length >= 2 && kinds.size === 1 && kinds.has("node")) {
      note(
        "info",
        `terminal "${n.id}" only chains other nodes — ensure those leaves have dual paths`
      );
    }
  }
  checks.push({
    check: "terminals_dual_supports",
    verdict: thinTerminals.length ? "warn" : "pass",
    note: thinTerminals.length
      ? `prefer ≥2 supports: ${thinTerminals.join("; ")}`
      : "terminals have multiple supports or minSupports≥2",
  });

  // Intermediate leads with zero supports (dead)
  const deadLeads = nodes.filter(
    (n) =>
      !(n.factId || ["identity", "method", "motive"].includes(n.role)) &&
      (n.supports ?? []).length === 0
  );
  if (deadLeads.length) {
    note(
      "medium",
      `leads with no supports (never resolve): ${deadLeads.map((n) => n.id).join(", ")}`
    );
  }

  // ── Leaf reachability ────────────────────────────────────────────────
  const reach = computeReachability(def);
  const badEv = [];
  const badKnow = [];
  for (const n of nodes) {
    for (const s of n.supports ?? []) {
      if (s.evidenceId && !reach.evidence.has(s.evidenceId)) {
        badEv.push(`${n.id}←${s.evidenceId}`);
      }
      if (s.knowledge) {
        const ch = charById.get(s.knowledge.characterId);
        const beat = knowledgeBeats(ch ?? { knowledge: {} }).find(
          (b) => b.id === s.knowledge.beatId
        );
        if (beat?.requiresEvidenceIds?.length) {
          for (const eid of beat.requiresEvidenceIds) {
            if (!reach.evidence.has(eid)) {
              badKnow.push(
                `${n.id}←${s.knowledge.characterId}/${s.knowledge.beatId} needs unreachable ${eid}`
              );
            }
          }
        }
      }
    }
  }
  checks.push({
    check: "graph_leaves_reachable",
    verdict: badEv.length || badKnow.length ? "fail" : "pass",
    note:
      [...badEv, ...badKnow].slice(0, 6).join("; ") ||
      "evidence/knowledge leaves reachable from turn-1 gates",
  });
  for (const x of [...badEv, ...badKnow].slice(6)) note("high", x);

  // ── Player-facing questions ──────────────────────────────────────────
  const questions = nodes.map((n) => n.question?.trim().toLowerCase());
  const qDups = questions.filter((q, i) => q && questions.indexOf(q) !== i);
  checks.push({
    check: "questions_unique",
    verdict: qDups.length ? "warn" : "pass",
    note: qDups.length
      ? `duplicate questions: ${[...new Set(qDups)].join(" | ")}`
      : "player-facing questions are unique",
  });

  // ── Spoiler hygiene: claim must not equal question ───────────────────
  const leaky = nodes.filter(
    (n) =>
      n.claim &&
      n.question &&
      n.claim.trim().toLowerCase() === n.question.trim().toLowerCase()
  );
  checks.push({
    check: "claim_differs_from_question",
    verdict: leaky.length ? "warn" : "pass",
    note: leaky.length
      ? `claim===question (claim is sealed but should state the answer): ${leaky.map((n) => n.id).join(", ")}`
      : "claims state sealed answers; questions are open",
  });

  // ── Root openness: some nodes open at start ──────────────────────────
  const roots = nodes.filter((n) => !(n.requires ?? []).length);
  checks.push({
    check: "has_root_leads",
    verdict: roots.length ? "pass" : "warn",
    note: roots.length
      ? `${roots.length} root lead(s) open without requires: ${roots.map((n) => n.id).join(", ")}`
      : "no root nodes — every question gated; players may see empty casebook at start",
  });

  // ── Stats for report ─────────────────────────────────────────────────
  const leafEv = new Set();
  for (const n of terminals) {
    const leaves = expandLeaves(n.id, byId);
    for (const e of leaves.evidence) leafEv.add(e);
  }

  return {
    audit: "deductions",
    grade: gradeOf(checks, findings),
    checks,
    findings,
    stats: {
      nodes: nodes.length,
      terminals: terminals.length,
      roots: roots.length,
      byRole,
      terminalLeafEvidence: [...leafEv],
    },
  };
}
