/**
 * Clue & item audit — fully deterministic.
 * Are there enough clues, can every one of them actually be found, is
 * anything a needle in a haystack (zero signposts), and does the machinery
 * (flags, gates, beat conditions) hold together the way the ENGINE reads it?
 */
import { gradeOf, isRuntimeFlag, mentionsAny, proseSources, tokens } from "./shared.mjs";

/**
 * Walk a beat `when` condition exactly the way the engine's
 * evaluateCondition does — and report author mistakes it would silently
 * swallow (and/or without `of`, game_flag without `equals`, unknown types).
 */
function validateCondition(cond, path, problems) {
  if (!cond || typeof cond !== "object") return;
  const t = cond.type;
  // Mirrors the full switch in packages/engine/src/conditions.ts — keep in sync.
  const KNOWN = new Set([
    "always", "never", "and", "or", "not",
    "game_flag", "has_evidence", "presented", "talked_to", "visited", "inventory_has",
    "character_willingness", "character_at", "character_known", "character_name_known",
    "character_pressure_at_least", "character_trust_at_least",
    "phase_is", "turn_at_least", "beat_fired",
    "case_active", "case_interactive", "case_status", "in_denouement",
    "resolution_outcome", "resolution_kind", "resolution_path",
    "clock_expired", "clock_running", "clock_at_most",
    "time_at_least", "time_minutes_at_least", "time_reached", "time_slot_is",
    "player_at", "player_not_at", "player_has_tag", "player_status_flag",
    "player_threat_is", "player_threat_at_least", "player_condition_is",
    "player_condition_at_least", "player_control_is", "player_control_at_least",
    "player_controlled_by", "player_not_free", "player_safe_haven_compromised",
    "location_accessible", "location_known", "exit_open",
    "object_stage", "object_unlocked", "item_condition", "item_flag", "item_has_tag",
    "item_holder", "item_examined_at_least", "item_used_at_least",
    "relationship", "relationship_known", "relationship_strength_at_least",
    "weather_is", "crowd_is", "environment_flag",
  ]);
  if (!KNOWN.has(t)) problems.push(`${path}: unknown condition type "${t}"`);
  if ((t === "and" || t === "or") && !Array.isArray(cond.of))
    problems.push(`${path}: ${t} without "of" — engine evaluates it as empty (and=true!)`);
  if (t === "not" && !cond.of) problems.push(`${path}: not without "of"`);
  if (t === "game_flag" && !("equals" in cond))
    problems.push(`${path}: game_flag without "equals" — never matches`);
  if (t === "has_evidence" && !cond.evidenceId) problems.push(`${path}: has_evidence without evidenceId`);
  if (t === "presented" && (!cond.evidenceId || !cond.toCharacterId))
    problems.push(`${path}: presented needs evidenceId + toCharacterId`);
  for (const kid of Array.isArray(cond.of) ? cond.of : cond.of ? [cond.of] : [])
    validateCondition(kid, path, problems);
}

/** Can this condition be satisfied given reachable flags/evidence? (optimistic on runtime state) */
function satisfiable(cond, flags, evidence, defaults) {
  if (!cond || typeof cond !== "object") return true;
  switch (cond.type) {
    case "and": return (cond.of ?? []).every((c) => satisfiable(c, flags, evidence, defaults));
    case "or": return (cond.of ?? []).length === 0 || (cond.of ?? []).some((c) => satisfiable(c, flags, evidence, defaults));
    case "not": return true; // a flag can be avoided; optimistic
    case "game_flag":
      if (cond.equals === true) return flags.has(cond.id) || isRuntimeFlag(cond.id);
      return defaults.get(cond.id) !== true || flags.has(cond.id); // false wanted: start state usually suffices
    case "has_evidence": return evidence.has(cond.evidenceId);
    case "presented": return evidence.has(cond.evidenceId);
    default: return true; // trust/time/turn/talk: earnable at runtime
  }
}

const flagReqOk = (req, flags) =>
  Object.entries(req ?? {}).every(([k, v]) => (v === true ? flags.has(k) || isRuntimeFlag(k) : true));

/**
 * Fixpoint reachability: which locations, evidence, and flags can a real
 * playthrough ever obtain?
 */
export function computeReachability(def) {
  const defaults = new Map((def.flags ?? []).map((f) => [f.id, f.defaultValue === true]));
  const flags = new Set((def.flags ?? []).filter((f) => f.defaultValue === true).map((f) => f.id));
  const evidence = new Set(def.player?.startingEvidenceIds ?? []);
  const locs = new Set([def.player?.startingLocationId].filter(Boolean));
  const byId = new Map(def.locations.map((l) => [l.id, l]));

  let grew = true;
  while (grew) {
    grew = false;
    const add = (set, v) => { if (v && !set.has(v)) { set.add(v); grew = true; } };
    for (const lid of [...locs]) {
      const loc = byId.get(lid);
      if (!loc) continue;
      for (const ex of loc.exits ?? []) {
        const evOk = (ex.requiresEvidenceIds ?? []).every((id) => evidence.has(id));
        if (flagReqOk(ex.requiresFlags, flags) && evOk) add(locs, ex.toLocationId);
      }
      for (const insp of loc.inspectables ?? []) {
        if (!flagReqOk(insp.hiddenUntilFlags, flags)) continue;
        const oi = insp.onInspect ?? {};
        const evOk = (oi.requiresEvidenceIds ?? []).every((id) => evidence.has(id));
        if (!flagReqOk(oi.requiresFlags, flags) || !evOk) continue;
        for (const id of oi.revealsEvidenceIds ?? []) add(evidence, id);
        for (const [f, v] of Object.entries(oi.setsFlags ?? {})) if (v === true) add(flags, f);
      }
    }
    for (const b of def.beats ?? []) {
      if (!satisfiable(b.when, flags, evidence, defaults)) continue;
      for (const ef of b.effects ?? []) {
        if (ef.type === "set_game_flag" && ef.value === true) add(flags, ef.id);
        if (ef.type === "set_game_flag_true") add(flags, ef.id);
        if (ef.type === "reveal_knowledge") continue;
      }
    }
  }
  return { flags, evidence, locations: locs };
}

export async function runCluesAudit(def) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });

  const evidenceIds = new Set(def.evidence.map((e) => e.id));
  const declaredFlags = new Set((def.flags ?? []).map((f) => f.id));
  const crit = def.solution?.criticalEvidenceIds ?? [];

  // 1. Dangling references
  const dangling = [];
  const inspOf = new Map();
  for (const l of def.locations)
    for (const i of l.inspectables ?? []) {
      inspOf.set(`${l.id}/${i.id}`, i);
      for (const id of i.onInspect?.revealsEvidenceIds ?? [])
        if (!evidenceIds.has(id)) dangling.push(`inspect ${l.id}/${i.id} reveals unknown evidence "${id}"`);
    }
  for (const e of def.evidence) {
    const da = e.discoverableAt;
    if (!da) continue;
    if (!inspOf.has(`${da.locationId}/${da.inspectableId}`))
      dangling.push(`evidence "${e.id}" points at missing ${da.locationId}/${da.inspectableId}`);
  }
  for (const c of def.characters)
    for (const k of [...(c.knowledge?.private ?? []), ...(c.knowledge?.secrets ?? [])])
      for (const id of k.requiresEvidenceIds ?? [])
        if (!evidenceIds.has(id)) dangling.push(`knowledge ${c.id}/${k.id} requires unknown evidence "${id}"`);
  checks.push({
    check: "references_resolve",
    verdict: dangling.length ? "fail" : "pass",
    note: dangling.join("; ") || `${def.evidence.length} evidence, ${inspOf.size} inspectables — all refs resolve`,
  });

  // 2. Beat condition shapes (as the ENGINE reads them)
  const shapeProblems = [];
  for (const b of def.beats ?? []) validateCondition(b.when, b.id, shapeProblems);
  checks.push({
    check: "beat_conditions_engine_valid",
    verdict: shapeProblems.length ? "fail" : "pass",
    note: shapeProblems.join("; ") || `${(def.beats ?? []).length} beats use engine-canonical condition shapes`,
  });

  // 3. Reachability
  const reach = computeReachability(def);
  const unreachableEv = def.evidence.filter((e) => !reach.evidence.has(e.id));
  const unreachableCrit = unreachableEv.filter((e) => crit.includes(e.id));
  checks.push({
    check: "critical_evidence_reachable",
    verdict: unreachableCrit.length ? "fail" : "pass",
    note: unreachableCrit.length
      ? `UNREACHABLE: ${unreachableCrit.map((e) => e.id).join(", ")}`
      : `all ${crit.length} critical items reachable from turn 1 state`,
  });
  for (const e of unreachableEv.filter((e) => !crit.includes(e.id)))
    note("high", `evidence "${e.id}" can never be obtained (gate chain unsatisfiable)`);

  // 4. Flag hygiene
  const setFlags = new Set();
  for (const l of def.locations)
    for (const i of l.inspectables ?? [])
      for (const f of Object.keys(i.onInspect?.setsFlags ?? {})) setFlags.add(f);
  for (const b of def.beats ?? [])
    for (const ef of b.effects ?? [])
      if (ef.type === "set_game_flag" || ef.type === "set_game_flag_true") setFlags.add(ef.id);
  const neverSet = [...declaredFlags].filter((f) => !setFlags.has(f) && !isRuntimeFlag(f));
  const undeclared = [...setFlags].filter((f) => !declaredFlags.has(f) && !isRuntimeFlag(f));
  for (const f of neverSet) note("medium", `flag "${f}" declared but nothing ever sets it`);
  for (const f of undeclared) note("medium", `flag "${f}" set but never declared`);
  checks.push({
    check: "flag_hygiene",
    verdict: neverSet.length + undeclared.length ? "warn" : "pass",
    note: neverSet.length + undeclared.length ? `${neverSet.length} orphan, ${undeclared.length} undeclared` : `${declaredFlags.size} flags all wired`,
  });

  // 5. Signposting — external pointers per evidence
  const sources = proseSources(def);
  const locName = new Map(def.locations.map((l) => [l.id, l.name]));
  const unsign = [];
  for (const e of def.evidence) {
    const da = e.discoverableAt ?? {};
    const insp = inspOf.get(`${da.locationId}/${da.inspectableId}`);
    const groups = [
      tokens(e.name),
      tokens(insp?.name ?? ""),
      tokens(locName.get(da.locationId) ?? ""),
    ].filter((g) => g.length);
    const pointers = sources.filter(
      (s) => s.locationId !== da.locationId && mentionsAny(s.text, groups)
    );
    if (pointers.length === 0) unsign.push(e.id);
    e._pointers = pointers.length; // annotate for report
  }
  const unsignCrit = unsign.filter((id) => crit.includes(id));
  checks.push({
    check: "critical_evidence_signposted",
    verdict: unsignCrit.length ? "fail" : "pass",
    note: unsignCrit.length
      ? `zero external pointers to: ${unsignCrit.join(", ")}`
      : "every critical item has ≥1 pointer outside its own room",
  });
  for (const id of unsign.filter((id) => !crit.includes(id)))
    note("info", `evidence "${id}" has no external signpost (fine if meant as a bonus find)`);

  // 6. Rubric facets have evidentiary backing
  const corpus = [
    ...def.evidence.map((e) => `${e.name} ${e.description}`),
    ...sources.map((s) => s.text),
  ].join(" ").toLowerCase();
  const unbacked = [];
  for (const fact of def.solution?.rubric?.requiredFacts ?? []) {
    const hit = (fact.matchHints ?? []).some((h) => corpus.includes(h.toLowerCase()));
    if (!hit) unbacked.push(fact.id);
  }
  checks.push({
    check: "rubric_facts_supported",
    verdict: unbacked.length ? "warn" : "pass",
    note: unbacked.length ? `no in-world text supports: ${unbacked.join(", ")}` : "every required fact is evidenced in-world",
  });

  // 7. Distribution
  const perLoc = new Map();
  for (const e of def.evidence) {
    const l = e.discoverableAt?.locationId ?? "(none)";
    perLoc.set(l, (perLoc.get(l) ?? 0) + 1);
  }
  const clustered = [...perLoc.entries()].filter(([, n]) => n >= Math.max(4, def.evidence.length / 3));
  checks.push({
    check: "evidence_spread",
    verdict: clustered.length ? "warn" : "pass",
    note: clustered.length
      ? `clustering: ${clustered.map(([l, n]) => `${l}=${n}`).join(", ")}`
      : `spread over ${perLoc.size} locations`,
  });
  const herrings = def.evidence.filter((e) => e.redHerring);
  checks.push({
    check: "red_herrings_exist",
    verdict: herrings.length ? "pass" : "warn",
    note: herrings.length ? herrings.map((e) => e.id).join(", ") : "no physical red herrings — deflection has no anchor",
  });

  return {
    audit: "clues",
    grade: gradeOf(checks, findings),
    checks,
    findings,
    stats: {
      evidence: def.evidence.length,
      critical: crit.length,
      redHerrings: herrings.length,
      pointers: Object.fromEntries(def.evidence.map((e) => [e.id, e._pointers ?? 0])),
    },
  };
}
