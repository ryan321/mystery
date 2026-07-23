/**
 * Location audit — map graph soundness, closed doors that can open,
 * rooms that pull their weight (people, inspectables, containers, clues),
 * and setting census (optional LLM).
 */
import { askJson, gradeOf } from "./shared.mjs";
import { computeReachability, fixtureContents } from "./clues.mjs";

export async function runLocationsAudit(def, { llm = true } = {}) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });
  const ids = new Set(def.locations.map((l) => l.id));
  const start = def.player?.startingLocationId;

  // 1. Exit graph: dangling + one-way + start
  const dangling = [];
  const oneWay = [];
  for (const l of def.locations) {
    for (const ex of l.exits ?? []) {
      if (!ids.has(ex.toLocationId)) {
        dangling.push(`${l.id} → ${ex.toLocationId}`);
        continue;
      }
      const dest = def.locations.find((d) => d.id === ex.toLocationId);
      if (!(dest.exits ?? []).some((r) => r.toLocationId === l.id)) {
        oneWay.push(`${l.id} → ${ex.toLocationId}`);
      }
    }
  }
  if (!start || !ids.has(start)) {
    checks.push({
      check: "start_location",
      verdict: "fail",
      note: `startingLocationId "${start}" missing`,
    });
  } else {
    checks.push({
      check: "start_location",
      verdict: "pass",
      note: `start: ${start}`,
    });
  }
  checks.push({
    check: "exits_resolve",
    verdict: dangling.length ? "fail" : "pass",
    note: dangling.join("; ") || "all exits point at real rooms",
  });
  checks.push({
    check: "exits_bidirectional",
    verdict: oneWay.length ? "warn" : "pass",
    note: oneWay.length
      ? `one-way: ${oneWay.join(", ")}`
      : "every door works both ways",
  });

  // 2. Reachability respecting startsClosed + set_exit_open beats
  const reach = computeReachability(def);
  const unreachable = def.locations.filter((l) => !reach.locations.has(l.id));
  checks.push({
    check: "all_rooms_reachable",
    verdict: unreachable.length ? "fail" : "pass",
    note: unreachable.length
      ? `unreachable from start (open-door graph): ${unreachable.map((l) => l.id).join(", ")}`
      : `all ${def.locations.length} rooms reachable from ${start} (including doors opened by beats)`,
  });

  // 3. Closed doors that never open
  const openers = new Set();
  for (const b of def.beats ?? []) {
    for (const ef of b.effects ?? []) {
      if (ef.type === "set_exit_open" && ef.value !== false) {
        openers.add(`${ef.from}->${ef.to}`);
      }
    }
  }
  const stuckClosed = [];
  for (const l of def.locations) {
    for (const ex of l.exits ?? []) {
      if (!ex.startsClosed) continue;
      const key = `${l.id}->${ex.toLocationId}`;
      const keyNeeds =
        (ex.requiresEvidenceIds ?? []).length > 0 ||
        Object.keys(ex.requiresFlags ?? {}).length > 0;
      if (!openers.has(key) && !keyNeeds) {
        stuckClosed.push(key);
      }
    }
  }
  checks.push({
    check: "closed_exits_can_open",
    verdict: stuckClosed.length ? "warn" : "pass",
    note: stuckClosed.length
      ? `startsClosed with no set_exit_open and no key/flag gate: ${stuckClosed.join(", ")}`
      : "closed doors have openers or key/flag gates",
  });

  // 4. Map coordinates
  const seen = new Map();
  const missing = [];
  for (const l of def.locations) {
    if (!l.map) {
      missing.push(l.id);
      continue;
    }
    const key = `${l.map.x},${l.map.y},${l.map.floor ?? 0}`;
    if (seen.has(key)) {
      note(
        "medium",
        `map collision: ${l.id} and ${seen.get(key)} share ${key}`
      );
    }
    seen.set(key, l.id);
  }
  checks.push({
    check: "map_coordinates",
    verdict:
      missing.length || findings.some((f) => f.text.startsWith("map collision"))
        ? "warn"
        : "pass",
    note: missing.length
      ? `no coords: ${missing.join(", ")}`
      : "unique coords on every room",
  });
  const floors = [
    ...new Set(def.locations.map((l) => l.map?.floor ?? 0)),
  ].sort((a, b) => a - b);
  checks.push({
    check: "floors",
    verdict: "pass",
    note: `floors present: ${floors.join(", ")}`,
  });

  // 5. Jobs — evidence (incl. container), inspectables, people, graph anchors
  const graphLocs = new Set();
  for (const e of def.evidence) {
    if (e.discoverableAt?.locationId)
      graphLocs.add(e.discoverableAt.locationId);
  }
  const stagingLoc = def.accusePolicy?.staging?.locationId;
  if (stagingLoc) graphLocs.add(stagingLoc);

  const jobs = {};
  let deadWeight = 0;
  for (const l of def.locations) {
    let ev = 0;
    let containers = 0;
    for (const i of l.inspectables ?? []) {
      const contents = fixtureContents(i);
      ev += contents.length;
      if (i.container) containers += 1;
    }
    // also count discoverableAt pointing here
    const da = def.evidence.filter(
      (e) => e.discoverableAt?.locationId === l.id
    ).length;
    const flagInsp = (l.inspectables ?? []).filter(
      (i) =>
        Object.keys(i.onInspect?.setsFlags ?? {}).length ||
        fixtureContents(i).length
    ).length;
    const texture = (l.inspectables ?? []).length;
    const people = def.characters.filter(
      (c) => c.defaultLocationId === l.id
    ).length;
    const present = (l.charactersPresent ?? []).length;
    jobs[l.id] = {
      evidence: Math.max(ev, da),
      containers,
      investigative: flagInsp,
      texture,
      people,
      present,
      clueCritical: graphLocs.has(l.id),
    };
    if (
      !ev &&
      !da &&
      !flagInsp &&
      !texture &&
      !people &&
      !present &&
      !graphLocs.has(l.id)
    ) {
      deadWeight += 1;
      note(
        "medium",
        `room "${l.id}" has no evidence, inspectables, people, or cast presence — dead weight`
      );
    }
  }
  checks.push({
    check: "rooms_pull_weight",
    verdict: deadWeight ? "warn" : "pass",
    note: deadWeight
      ? `${deadWeight} empty room(s)`
      : "each room offers evidence, texture, or people",
  });

  // Clue-critical rooms should be reachable
  const criticalUnreachable = [...graphLocs].filter(
    (id) => ids.has(id) && !reach.locations.has(id)
  );
  checks.push({
    check: "clue_rooms_reachable",
    verdict: criticalUnreachable.length ? "fail" : "pass",
    note: criticalUnreachable.length
      ? `clue/staging rooms unreachable: ${criticalUnreachable.join(", ")}`
      : `all ${graphLocs.size} clue/staging rooms reachable`,
  });

  // Accuse staging location exists
  if (def.accusePolicy?.staging?.locationId) {
    const sid = def.accusePolicy.staging.locationId;
    checks.push({
      check: "accuse_staging_location",
      verdict: ids.has(sid) ? "pass" : "fail",
      note: ids.has(sid)
        ? `formal Accuse stages in ${sid}`
        : `staging location "${sid}" missing`,
    });
  }

  // 6. Inspectable density
  const barren = def.locations.filter(
    (l) => (l.inspectables ?? []).length === 0 && graphLocs.has(l.id)
  );
  checks.push({
    check: "clue_rooms_have_inspectables",
    verdict: barren.length ? "warn" : "pass",
    note: barren.length
      ? `clue rooms with zero inspectables: ${barren.map((l) => l.id).join(", ")}`
      : "clue-bearing rooms have inspectables",
  });

  // 7. Setting census (LLM)
  let census = null;
  if (llm) {
    census = await askJson(`You audit interactive mystery worlds for realism of PLACE.
Setting: ${JSON.stringify(def.meta?.setting)} | theme: ${def.meta?.theme} | tone: ${def.meta?.tone}
Premise: ${JSON.stringify(def.meta?.premise)}
Rooms (id, name, floor, description):
${JSON.stringify(
  def.locations.map((l) => ({
    id: l.id,
    name: l.name,
    floor: l.map?.floor ?? 0,
    description: l.description,
    exits: (l.exits ?? []).map((e) => e.toLocationId),
    inspectableCount: (l.inspectables ?? []).length,
  })),
  null,
  1
)}

Judge ONLY place-plausibility and navigation usefulness, not plot spoilers. Reply JSON:
{
 "missing_rooms": [{"room": "...", "why": "...", "severity": "breaking|moderate|minor"}],
 "implausible": [{"id": "...", "why": "..."}],
 "dead_ends_or_confusing": [{"id": "...", "why": "..."}],
 "notes": "one short paragraph"
}
List a missing room ONLY if this specific setting genuinely demands it (a manor demands a kitchen; it does not demand an armory). Severity "breaking" means readers would notice its absence.`);
    for (const m of census.missing_rooms ?? []) {
      note(
        m.severity === "breaking"
          ? "high"
          : m.severity === "moderate"
            ? "medium"
            : "info",
        `missing room: ${m.room} — ${m.why}`
      );
    }
    for (const i of census.implausible ?? []) {
      note("medium", `implausible room ${i.id}: ${i.why}`);
    }
    for (const d of census.dead_ends_or_confusing ?? []) {
      note("info", `navigation: ${d.id} — ${d.why}`);
    }
    checks.push({
      check: "setting_census",
      verdict: (census.missing_rooms ?? []).some((m) => m.severity !== "minor")
        ? "warn"
        : "pass",
      note: census.notes ?? "",
    });
  }

  return {
    audit: "locations",
    grade: gradeOf(checks, findings),
    checks,
    findings,
    jobs,
    census,
    reachability: {
      locations: [...reach.locations],
      count: reach.locations.size,
    },
  };
}
