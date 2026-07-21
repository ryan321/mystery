/**
 * Character audit — do we have everyone this story and setting need, is
 * every suspect armed (defenses, knowledge, gates that resolve), and does
 * each character have three dimensions rather than a job title?
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { askJson, gradeOf } from "./shared.mjs";
import { computeReachability } from "./clues.mjs";

export async function runCharactersAudit(def, { llm = true, caseDir } = {}) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });
  const locIds = new Set(def.locations.map((l) => l.id));
  const evidenceIds = new Set(def.evidence.map((e) => e.id));
  const reach = computeReachability(def);

  // 1. Census: the mystery's skeleton crew
  const roles = { victim: [], suspect: [], witness: [], support: [] };
  for (const c of def.characters) (roles[c.storyRole ?? "support"] ?? roles.support).push(c.id);
  const guilty = def.solution?.guiltyPartyIds ?? [];
  const guiltyOk = guilty.every((g) => def.characters.some((c) => c.id === g));
  checks.push({
    check: "census",
    verdict: roles.victim.length && roles.suspect.length >= 3 && guiltyOk ? "pass" : "fail",
    note: `victim=${roles.victim.length} suspects=${roles.suspect.length} witnesses=${roles.witness.length} support=${roles.support.length}; guilty ${guilty.join(",")} ${guiltyOk ? "valid" : "MISSING FROM CAST"}`,
  });

  // 2. Per-character mechanical completeness
  for (const c of def.characters) {
    if (c.storyRole === "victim") continue;
    if (!c.defaultLocationId || !locIds.has(c.defaultLocationId))
      note("high", `${c.id}: defaultLocationId "${c.defaultLocationId}" is not a room`);
    if ((c.shortBio ?? "").split(/\s+/).length < 20)
      note("medium", `${c.id}: shortBio under 20 words — the performer has nothing to play`);
    if (!c.voice) note("info", `${c.id}: no voice note`);
    if (c.storyRole === "suspect" && !(c.defenses ?? []).length)
      note("medium", `${c.id}: suspect with no defenses — folds at first pressure`);
    if (c.portrait && caseDir && !existsSync(join(caseDir, c.portrait)))
      note("info", `${c.id}: portrait file missing (${c.portrait})`);
    if (!c.portrait) note("info", `${c.id}: no portrait authored yet`);
    const items = [...(c.knowledge?.private ?? []), ...(c.knowledge?.secrets ?? [])];
    for (const k of items) {
      for (const id of k.requiresEvidenceIds ?? [])
        if (!evidenceIds.has(id)) note("high", `${c.id}/${k.id}: gate references unknown evidence "${id}"`);
        else if (!reach.evidence.has(id)) note("high", `${c.id}/${k.id}: gated behind unreachable evidence "${id}"`);
    }
    if (!items.length && c.storyRole === "suspect")
      note("medium", `${c.id}: suspect with no private knowledge or secrets — nothing to uncover`);
  }
  checks.push({
    check: "mechanical_completeness",
    verdict: findings.some((f) => f.severity === "high") ? "fail" : findings.some((f) => f.severity === "medium") ? "warn" : "pass",
    note: "bios, defenses, gates, placements",
  });

  // 3. Depth + missing archetypes (LLM)
  let depth = null;
  if (llm) {
    depth = await askJson(`You audit mystery casts. Setting: ${JSON.stringify(def.meta?.setting)} (${def.meta?.theme}, ${def.meta?.tone}).
The sealed solution names ${JSON.stringify(def.solution?.guiltyPartyIds)} guilty; judge the CAST AS AUTHORED.

Cast:
${JSON.stringify(def.characters.map((c) => ({
  id: c.id, role: c.storyRole, bio: c.shortBio, voice: c.voice,
  public: c.knowledge?.public,
  privateCount: (c.knowledge?.private ?? []).length,
  secretCount: (c.knowledge?.secrets ?? []).length,
  defenses: c.defenses ?? [],
})), null, 1)}

For EACH character judge three dimensions: a want (what they're after), a fear or wound,
and a contradiction (something that cuts against their surface). A flat character has
none; serviceable has one-two; deep has all three VISIBLE IN THE AUTHORED TEXT.
Also: does the setting demand anyone who doesn't exist? (Only if truly demanded.)

Reply JSON:
{
 "characters": [{"id": "...", "depth": "deep|serviceable|flat", "want": "...", "fear": "...", "contradiction": "...", "function": ["clue-carrier"|"red-herring"|"obstacle"|"alibi"|"humanizer"|"nudge"], "suggestion": "..."}],
 "missing_people": [{"who": "...", "why": "...", "severity": "breaking|moderate|minor"}],
 "notes": "one short paragraph"
}`);
    for (const ch of depth.characters ?? [])
      if (ch.depth === "flat") note("medium", `${ch.id} is flat — ${ch.suggestion}`);
    for (const m of depth.missing_people ?? [])
      note(m.severity === "breaking" ? "high" : m.severity === "moderate" ? "medium" : "info",
        `missing person: ${m.who} — ${m.why}`);
    const flat = (depth.characters ?? []).filter((c) => c.depth === "flat").length;
    checks.push({
      check: "depth",
      verdict: flat ? "warn" : "pass",
      note: `${(depth.characters ?? []).filter((c) => c.depth === "deep").length} deep / ${(depth.characters ?? []).filter((c) => c.depth === "serviceable").length} serviceable / ${flat} flat`,
    });
  }

  return { audit: "characters", grade: gradeOf(checks, findings), checks, findings, roles, depth };
}
