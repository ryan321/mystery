/**
 * Location audit — do we have the rooms this setting demands, is the map
 * graph sound (connectivity, exits, coordinates), and does every room
 * pull its weight?
 */
import { askJson, gradeOf } from "./shared.mjs";
import { computeReachability } from "./clues.mjs";

export async function runLocationsAudit(def, { llm = true } = {}) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });
  const ids = new Set(def.locations.map((l) => l.id));

  // 1. Exit graph: dangling + one-way + start reachability
  const dangling = [];
  const oneWay = [];
  for (const l of def.locations) {
    for (const ex of l.exits ?? []) {
      if (!ids.has(ex.toLocationId)) {
        dangling.push(`${l.id} → ${ex.toLocationId}`);
        continue;
      }
      const dest = def.locations.find((d) => d.id === ex.toLocationId);
      if (!(dest.exits ?? []).some((r) => r.toLocationId === l.id))
        oneWay.push(`${l.id} → ${ex.toLocationId}`);
    }
  }
  checks.push({
    check: "exits_resolve",
    verdict: dangling.length ? "fail" : "pass",
    note: dangling.join("; ") || "all exits point at real rooms",
  });
  checks.push({
    check: "exits_bidirectional",
    verdict: oneWay.length ? "warn" : "pass",
    note: oneWay.length ? `one-way: ${oneWay.join(", ")}` : "every door works both ways",
  });

  const reach = computeReachability(def);
  const unreachable = def.locations.filter((l) => !reach.locations.has(l.id));
  checks.push({
    check: "all_rooms_reachable",
    verdict: unreachable.length ? "fail" : "pass",
    note: unreachable.length
      ? `unreachable from start: ${unreachable.map((l) => l.id).join(", ")}`
      : `all ${def.locations.length} rooms reachable from ${def.player?.startingLocationId}`,
  });

  // 2. Map coordinates
  const seen = new Map();
  const missing = [];
  for (const l of def.locations) {
    if (!l.map) { missing.push(l.id); continue; }
    const key = `${l.map.x},${l.map.y},${l.map.floor ?? 0}`;
    if (seen.has(key)) note("medium", `map collision: ${l.id} and ${seen.get(key)} share ${key}`);
    seen.set(key, l.id);
  }
  checks.push({
    check: "map_coordinates",
    verdict: missing.length || findings.some((f) => f.text.startsWith("map collision")) ? "warn" : "pass",
    note: missing.length ? `no coords: ${missing.join(", ")}` : "unique coords on every room",
  });
  const floors = [...new Set(def.locations.map((l) => l.map?.floor ?? 0))].sort((a, b) => a - b);
  checks.push({ check: "floors", verdict: "pass", note: `floors present: ${floors.join(", ")}` });

  // 3. Jobs — what each room contributes
  const jobs = {};
  for (const l of def.locations) {
    const ev = def.evidence.filter((e) => e.discoverableAt?.locationId === l.id).length;
    const flagInsp = (l.inspectables ?? []).filter(
      (i) => Object.keys(i.onInspect?.setsFlags ?? {}).length || (i.onInspect?.revealsEvidenceIds ?? []).length
    ).length;
    const texture = (l.inspectables ?? []).length - flagInsp;
    const people = def.characters.filter((c) => c.defaultLocationId === l.id).length;
    jobs[l.id] = { evidence: ev, investigative: flagInsp, texture, people };
    if (!ev && !flagInsp && !texture && !people)
      note("medium", `room "${l.id}" has no evidence, no inspectables, no people — dead weight`);
  }
  checks.push({
    check: "rooms_pull_weight",
    verdict: findings.some((f) => f.text.includes("dead weight")) ? "warn" : "pass",
    note: "each room offers evidence, texture, or people",
  });

  // 4. Setting census (LLM): what rooms does this setting demand?
  let census = null;
  if (llm) {
    census = await askJson(`You audit interactive mystery worlds for realism of PLACE.
Setting: ${JSON.stringify(def.meta?.setting)} | theme: ${def.meta?.theme} | tone: ${def.meta?.tone}
Premise: ${JSON.stringify(def.meta?.premise)}
Rooms (id, name, floor, description):
${JSON.stringify(def.locations.map((l) => ({ id: l.id, name: l.name, floor: l.map?.floor ?? 0, description: l.description })), null, 1)}

Judge ONLY place-plausibility, not plot. Reply JSON:
{
 "missing_rooms": [{"room": "...", "why": "...", "severity": "breaking|moderate|minor"}],
 "implausible": [{"id": "...", "why": "..."}],
 "notes": "one short paragraph"
}
List a missing room ONLY if this specific setting genuinely demands it (a manor demands a kitchen; it does not demand an armory). Severity "breaking" means readers would notice its absence.`);
    for (const m of census.missing_rooms ?? [])
      note(m.severity === "breaking" ? "high" : m.severity === "moderate" ? "medium" : "info",
        `missing room: ${m.room} — ${m.why}`);
    for (const i of census.implausible ?? []) note("medium", `implausible room ${i.id}: ${i.why}`);
    checks.push({
      check: "setting_census",
      verdict: (census.missing_rooms ?? []).some((m) => m.severity !== "minor") ? "warn" : "pass",
      note: census.notes ?? "",
    });
  }

  return { audit: "locations", grade: gradeOf(checks, findings), checks, findings, jobs, census };
}
