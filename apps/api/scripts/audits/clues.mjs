/**
 * Clue & item audit — fully deterministic.
 *
 * Items/fixtures: discovery paths (container.contains + revealsEvidenceIds),
 * reachable gates, signposts, readable/usableOn, distribution.
 * Solution graph: structural integrity is in deductions.mjs; this file
 * still checks critical evidence + rubric text backing.
 */
import {
  gradeOf,
  isRuntimeFlag,
  mentionsAny,
  proseSources,
  tokens,
} from "./shared.mjs";

/**
 * Walk a beat `when` condition exactly the way the engine's
 * evaluateCondition does — and report author mistakes it would silently
 * swallow (and/or without `of`, game_flag without `equals`, unknown types).
 */
function validateCondition(cond, path, problems) {
  if (!cond || typeof cond !== "object") return;
  const t = cond.type;
  // Mirrors packages/engine/src/conditions.ts — keep in sync.
  const KNOWN = new Set([
    "always",
    "never",
    "and",
    "or",
    "not",
    "game_flag",
    "has_evidence",
    "presented",
    "talked_to",
    "visited",
    "inventory_has",
    "character_willingness",
    "character_at",
    "character_known",
    "character_name_known",
    "character_pressure_at_least",
    "character_trust_at_least",
    "phase_is",
    "turn_at_least",
    "beat_fired",
    "case_active",
    "case_interactive",
    "case_status",
    "in_denouement",
    "resolution_outcome",
    "resolution_kind",
    "resolution_path",
    "clock_expired",
    "clock_running",
    "clock_at_most",
    "time_at_least",
    "time_minutes_at_least",
    "time_reached",
    "time_slot_is",
    "player_at",
    "player_not_at",
    "player_has_tag",
    "player_status_flag",
    "player_threat_is",
    "player_threat_at_least",
    "player_condition_is",
    "player_condition_at_least",
    "player_control_is",
    "player_control_at_least",
    "player_controlled_by",
    "player_not_free",
    "player_safe_haven_compromised",
    "location_accessible",
    "location_known",
    "exit_open",
    "object_stage",
    "object_unlocked",
    "item_condition",
    "item_flag",
    "item_has_tag",
    "item_holder",
    "item_examined_at_least",
    "item_used_at_least",
    "relationship",
    "relationship_known",
    "relationship_strength_at_least",
    "weather_is",
    "crowd_is",
    "environment_flag",
  ]);
  if (!KNOWN.has(t)) problems.push(`${path}: unknown condition type "${t}"`);
  if ((t === "and" || t === "or") && !Array.isArray(cond.of))
    problems.push(
      `${path}: ${t} without "of" — engine evaluates it as empty (and=true!)`
    );
  if (t === "not" && !cond.of) problems.push(`${path}: not without "of"`);
  if (t === "game_flag" && !("equals" in cond))
    problems.push(`${path}: game_flag without "equals" — never matches`);
  if (t === "has_evidence" && !cond.evidenceId)
    problems.push(`${path}: has_evidence without evidenceId`);
  if (t === "presented" && (!cond.evidenceId || !cond.toCharacterId))
    problems.push(`${path}: presented needs evidenceId + toCharacterId`);
  for (const kid of Array.isArray(cond.of)
    ? cond.of
    : cond.of
      ? [cond.of]
      : [])
    validateCondition(kid, path, problems);
}

/** Can this condition be satisfied given reachable flags/evidence? (optimistic) */
function satisfiable(cond, flags, evidence, defaults) {
  if (!cond || typeof cond !== "object") return true;
  switch (cond.type) {
    case "and":
      return (cond.of ?? []).every((c) =>
        satisfiable(c, flags, evidence, defaults)
      );
    case "or":
      return (
        (cond.of ?? []).length === 0 ||
        (cond.of ?? []).some((c) => satisfiable(c, flags, evidence, defaults))
      );
    case "not":
      return true;
    case "game_flag":
      if (cond.equals === true) return flags.has(cond.id) || isRuntimeFlag(cond.id);
      return defaults.get(cond.id) !== true || flags.has(cond.id);
    case "has_evidence":
    case "inventory_has":
      return evidence.has(cond.evidenceId ?? cond.itemId);
    case "presented":
      return evidence.has(cond.evidenceId);
    default:
      return true;
  }
}

const flagReqOk = (req, flags) =>
  Object.entries(req ?? {}).every(([k, v]) =>
    v === true ? flags.has(k) || isRuntimeFlag(k) : true
  );

/** Evidence ids a fixture can yield (container preferred, then onInspect). */
export function fixtureContents(insp) {
  const fromContainer = insp.container?.contains ?? [];
  if (fromContainer.length) return fromContainer;
  return insp.onInspect?.revealsEvidenceIds ?? [];
}

/**
 * Fixpoint reachability: locations, open exits, evidence, flags a real
 * playthrough can obtain from turn-1 state (optimistic on trust/talk/time).
 */
export function computeReachability(def) {
  const defaults = new Map(
    (def.flags ?? []).map((f) => [f.id, f.defaultValue === true])
  );
  const flags = new Set(
    (def.flags ?? []).filter((f) => f.defaultValue === true).map((f) => f.id)
  );
  const evidence = new Set(def.player?.startingEvidenceIds ?? []);
  const locs = new Set([def.player?.startingLocationId].filter(Boolean));
  const byId = new Map(def.locations.map((l) => [l.id, l]));
  /** `${from}->${to}` → open */
  const exitOpen = new Map();
  for (const l of def.locations) {
    for (const ex of l.exits ?? []) {
      exitOpen.set(`${l.id}->${ex.toLocationId}`, !ex.startsClosed);
    }
  }
  /** location accessible (default true unless startsAccessible false) */
  const accessible = new Map(
    def.locations.map((l) => [l.id, l.startsAccessible !== false])
  );

  let grew = true;
  let guard = 200;
  while (grew && guard-- > 0) {
    grew = false;
    const add = (set, v) => {
      if (v != null && !set.has(v)) {
        set.add(v);
        grew = true;
      }
    };
    const setExit = (key, open) => {
      if (exitOpen.get(key) !== open) {
        exitOpen.set(key, open);
        grew = true;
      }
    };

    for (const lid of [...locs]) {
      const loc = byId.get(lid);
      if (!loc) continue;
      for (const ex of loc.exits ?? []) {
        const key = `${lid}->${ex.toLocationId}`;
        if (exitOpen.get(key) === false) continue;
        const dest = ex.toLocationId;
        if (accessible.get(dest) === false) continue;
        const evOk = (ex.requiresEvidenceIds ?? []).every((id) =>
          evidence.has(id)
        );
        if (flagReqOk(ex.requiresFlags, flags) && evOk) add(locs, dest);
      }
      for (const insp of loc.inspectables ?? []) {
        if (!flagReqOk(insp.hiddenUntilFlags, flags)) continue;
        const oi = insp.onInspect ?? {};
        const keys = oi.requiresEvidenceIds ?? [];
        const evOk = keys.every((id) => evidence.has(id));
        // Locked container: need keys or unlockRequires optimistically if keys held
        if (insp.container?.locked) {
          const unlock = insp.container.unlockRequires;
          if (unlock && !satisfiable(unlock, flags, evidence, defaults)) {
            if (!keys.length || !evOk) continue;
          } else if (!unlock && keys.length && !evOk) {
            continue;
          }
        } else if (!flagReqOk(oi.requiresFlags, flags) || !evOk) {
          continue;
        }
        for (const id of fixtureContents(insp)) add(evidence, id);
        for (const [f, v] of Object.entries(oi.setsFlags ?? {})) {
          if (v === true) add(flags, f);
        }
      }
    }

    for (const b of def.beats ?? []) {
      if (!satisfiable(b.when, flags, evidence, defaults)) continue;
      for (const ef of b.effects ?? []) {
        if (ef.type === "set_game_flag" && ef.value === true) add(flags, ef.id);
        if (ef.type === "set_game_flag_true") add(flags, ef.id);
        if (ef.type === "set_exit_open") {
          const key = `${ef.from}->${ef.to}`;
          setExit(key, ef.value !== false);
        }
        if (ef.type === "set_location_accessible" && ef.locationId) {
          const next = ef.value !== false;
          if (accessible.get(ef.locationId) !== next) {
            accessible.set(ef.locationId, next);
            grew = true;
          }
        }
        if (
          (ef.type === "add_evidence" || ef.type === "give_evidence") &&
          ef.evidenceId
        ) {
          add(evidence, ef.evidenceId);
        }
      }
    }
  }
  return { flags, evidence, locations: locs, exitOpen, accessible };
}

export async function runCluesAudit(def) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });

  const evidenceIds = new Set(def.evidence.map((e) => e.id));
  const declaredFlags = new Set((def.flags ?? []).map((f) => f.id));
  const crit = def.solution?.criticalEvidenceIds ?? [];
  const locIds = new Set(def.locations.map((l) => l.id));
  const charIds = new Set(def.characters.map((c) => c.id));

  // 1. Discovery wiring: discoverableAt ↔ fixture contents
  const dangling = [];
  const inspOf = new Map();
  const revealedBy = new Map(); // evidenceId → [loc/insp]
  for (const l of def.locations) {
    for (const i of l.inspectables ?? []) {
      inspOf.set(`${l.id}/${i.id}`, { loc: l, insp: i });
      for (const id of fixtureContents(i)) {
        if (!evidenceIds.has(id)) {
          dangling.push(
            `inspect ${l.id}/${i.id} contains unknown evidence "${id}"`
          );
        } else {
          if (!revealedBy.has(id)) revealedBy.set(id, []);
          revealedBy.get(id).push(`${l.id}/${i.id}`);
        }
      }
    }
  }
  for (const e of def.evidence) {
    const da = e.discoverableAt;
    if (!da) {
      // starting inventory ok; pure knowledge items rare
      if (!(def.player?.startingEvidenceIds ?? []).includes(e.id)) {
        note(
          "info",
          `evidence "${e.id}" has no discoverableAt (ok if starting inventory or pure red-herring talk prop)`
        );
      }
      continue;
    }
    if (!locIds.has(da.locationId)) {
      dangling.push(
        `evidence "${e.id}" discoverableAt unknown location "${da.locationId}"`
      );
      continue;
    }
    const key = `${da.locationId}/${da.inspectableId}`;
    if (!inspOf.has(key)) {
      dangling.push(`evidence "${e.id}" points at missing ${key}`);
      continue;
    }
    const { insp } = inspOf.get(key);
    if (!fixtureContents(insp).includes(e.id)) {
      dangling.push(
        `evidence "${e.id}" discoverableAt ${key} but fixture does not list it in container.contains or onInspect.revealsEvidenceIds`
      );
    }
  }
  for (const c of def.characters) {
    for (const k of [
      ...(c.knowledge?.private ?? []),
      ...(c.knowledge?.secrets ?? []),
    ]) {
      for (const id of k.requiresEvidenceIds ?? []) {
        if (!evidenceIds.has(id)) {
          dangling.push(
            `knowledge ${c.id}/${k.id} requires unknown evidence "${id}"`
          );
        }
      }
    }
  }

  // usableOn / readable
  for (const e of def.evidence) {
    for (const u of e.usableOn ?? []) {
      const tid = u.targetId;
      const ok =
        evidenceIds.has(tid) ||
        charIds.has(tid) ||
        locIds.has(tid) ||
        [...inspOf.keys()].some((k) => k.endsWith(`/${tid}`));
      if (!ok) {
        dangling.push(
          `evidence "${e.id}" usableOn target "${tid}" is not a known id`
        );
      }
    }
  }

  checks.push({
    check: "references_resolve",
    verdict: dangling.length ? "fail" : "pass",
    note:
      dangling.join("; ") ||
      `${def.evidence.length} evidence, ${inspOf.size} inspectables — discovery wiring ok`,
  });

  // 2. Dual listing: container vs reveals (prefer one path)
  let dual = 0;
  for (const l of def.locations) {
    for (const i of l.inspectables ?? []) {
      const c = i.container?.contains ?? [];
      const r = i.onInspect?.revealsEvidenceIds ?? [];
      if (c.length && r.length && c.some((id) => r.includes(id))) dual += 1;
    }
  }
  checks.push({
    check: "fixture_single_discovery_path",
    verdict: dual ? "warn" : "pass",
    note: dual
      ? `${dual} fixture(s) list the same id in both container.contains and revealsEvidenceIds — prefer container only`
      : "fixtures use a single discovery list (container or onInspect)",
  });

  // 3. Beat condition shapes
  const shapeProblems = [];
  for (const b of def.beats ?? []) validateCondition(b.when, b.id, shapeProblems);
  for (const e of def.evidence) {
    for (const u of e.usableOn ?? []) {
      if (u.requires) validateCondition(u.requires, `${e.id}.usableOn`, shapeProblems);
    }
  }
  for (const l of def.locations) {
    for (const i of l.inspectables ?? []) {
      if (i.container?.unlockRequires) {
        validateCondition(
          i.container.unlockRequires,
          `${l.id}/${i.id}.unlockRequires`,
          shapeProblems
        );
      }
    }
  }
  checks.push({
    check: "beat_conditions_engine_valid",
    verdict: shapeProblems.length ? "fail" : "pass",
    note:
      shapeProblems.join("; ") ||
      `${(def.beats ?? []).length} beats use engine-canonical condition shapes`,
  });

  // 4. Reachability
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
  for (const e of unreachableEv.filter((e) => !crit.includes(e.id))) {
    note(
      "high",
      `evidence "${e.id}" can never be obtained (gate chain unsatisfiable from start)`
    );
  }

  // 5. Flag hygiene
  const setFlags = new Set();
  for (const l of def.locations) {
    for (const i of l.inspectables ?? []) {
      for (const f of Object.keys(i.onInspect?.setsFlags ?? {})) setFlags.add(f);
    }
  }
  for (const b of def.beats ?? []) {
    for (const ef of b.effects ?? []) {
      if (ef.type === "set_game_flag" || ef.type === "set_game_flag_true")
        setFlags.add(ef.id);
    }
  }
  const neverSet = [...declaredFlags].filter(
    (f) => !setFlags.has(f) && !isRuntimeFlag(f)
  );
  const undeclared = [...setFlags].filter(
    (f) => !declaredFlags.has(f) && !isRuntimeFlag(f)
  );
  for (const f of neverSet)
    note("medium", `flag "${f}" declared but nothing ever sets it`);
  for (const f of undeclared)
    note("medium", `flag "${f}" set but never declared`);
  checks.push({
    check: "flag_hygiene",
    verdict: neverSet.length + undeclared.length ? "warn" : "pass",
    note:
      neverSet.length + undeclared.length
        ? `${neverSet.length} orphan, ${undeclared.length} undeclared`
        : `${declaredFlags.size} flags all wired`,
  });

  // 6. Signposting
  const sources = proseSources(def);
  const locName = new Map(def.locations.map((l) => [l.id, l.name]));
  const unsign = [];
  for (const e of def.evidence) {
    const da = e.discoverableAt ?? {};
    const entry = inspOf.get(`${da.locationId}/${da.inspectableId}`);
    const insp = entry?.insp;
    const groups = [
      tokens(e.name),
      tokens(insp?.name ?? ""),
      tokens(locName.get(da.locationId) ?? ""),
    ].filter((g) => g.length);
    const pointers = sources.filter(
      (s) => s.locationId !== da.locationId && mentionsAny(s.text, groups)
    );
    if (pointers.length === 0) unsign.push(e.id);
    e._pointers = pointers.length;
  }
  const unsignCrit = unsign.filter((id) => crit.includes(id));
  checks.push({
    check: "critical_evidence_signposted",
    verdict: unsignCrit.length ? "fail" : "pass",
    note: unsignCrit.length
      ? `zero external pointers to: ${unsignCrit.join(", ")}`
      : "every critical item has ≥1 pointer outside its own room",
  });
  for (const id of unsign.filter((id) => !crit.includes(id))) {
    note(
      "info",
      `evidence "${id}" has no external signpost (fine if meant as a bonus find)`
    );
  }

  // 7. Rubric facets have evidentiary backing
  const corpus = [
    ...def.evidence.map((e) => `${e.name} ${e.description}`),
    ...sources.map((s) => s.text),
    ...(def.deductions ?? []).map((n) => `${n.question} ${n.claim}`),
  ]
    .join(" ")
    .toLowerCase();
  const unbacked = [];
  for (const fact of def.solution?.rubric?.requiredFacts ?? []) {
    const hit = (fact.matchHints ?? []).some((h) =>
      corpus.includes(h.toLowerCase())
    );
    if (!hit) unbacked.push(fact.id);
  }
  checks.push({
    check: "rubric_facts_supported",
    verdict: unbacked.length ? "warn" : "pass",
    note: unbacked.length
      ? `no in-world text supports: ${unbacked.join(", ")}`
      : "every required fact is evidenced in-world",
  });

  // 8. Distribution
  const perLoc = new Map();
  for (const e of def.evidence) {
    const l = e.discoverableAt?.locationId ?? "(none)";
    perLoc.set(l, (perLoc.get(l) ?? 0) + 1);
  }
  const clustered = [...perLoc.entries()].filter(
    ([, n]) => n >= Math.max(4, def.evidence.length / 3)
  );
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
    note: herrings.length
      ? herrings.map((e) => e.id).join(", ")
      : "no physical red herrings — deflection has no anchor",
  });

  // 9. Item affordances hygiene
  const readable = def.evidence.filter((e) => e.readable?.text);
  const usable = def.evidence.filter((e) => (e.usableOn ?? []).length);
  checks.push({
    check: "item_affordances",
    verdict: "pass",
    note: `${readable.length} readable, ${usable.length} with usableOn (informational)`,
  });

  // 10. Critical set vs solution graph leaves (if graph present)
  const graphEv = new Set();
  for (const n of def.deductions ?? []) {
    for (const s of n.supports ?? []) {
      if (s.evidenceId) graphEv.add(s.evidenceId);
    }
  }
  if (graphEv.size) {
    const critNotInGraph = crit.filter((id) => !graphEv.has(id));
    const graphUnreachable = [...graphEv].filter((id) => !reach.evidence.has(id));
    checks.push({
      check: "critical_vs_solution_graph",
      verdict:
        critNotInGraph.length || graphUnreachable.length ? "warn" : "pass",
      note: [
        critNotInGraph.length
          ? `critical not used as graph leaf: ${critNotInGraph.join(", ")}`
          : null,
        graphUnreachable.length
          ? `graph leaves unreachable: ${graphUnreachable.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("; ") || "critical evidence and graph leaves align / reachable",
    });
  }

  return {
    audit: "clues",
    grade: gradeOf(checks, findings),
    checks,
    findings,
    stats: {
      evidence: def.evidence.length,
      critical: crit.length,
      redHerrings: herrings.length,
      readable: readable.length,
      usableOn: usable.length,
      pointers: Object.fromEntries(
        def.evidence.map((e) => [e.id, e._pointers ?? 0])
      ),
      reachableEvidence: reach.evidence.size,
      reachableLocations: reach.locations.size,
    },
  };
}
