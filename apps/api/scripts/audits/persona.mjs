/**
 * Persona audit — the player's character: why are they there, what is
 * their role, and does it make sense? A persona must justify presence
 * (summons), access (role/authority), effort (stakes), and knowledge
 * (stranger vs local), or the whole investigation stands on air.
 */
import { askJson, gradeOf } from "./shared.mjs";

export async function runPersonaAudit(def, { llm = true } = {}) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });
  const p = def.player ?? {};

  // 1. Mechanical completeness
  const required = ["displayName", "role", "authority", "objective", "startingKnowledge", "startingLocationId"];
  const missing = required.filter((k) => !p[k]);
  checks.push({
    check: "player_block_complete",
    verdict: missing.length ? "fail" : "pass",
    note: missing.length ? `missing: ${missing.join(", ")}` : "identity, role, objective, knowledge all authored",
  });
  const locIds = new Set(def.locations.map((l) => l.id));
  if (p.startingLocationId && !locIds.has(p.startingLocationId))
    note("high", `startingLocationId "${p.startingLocationId}" is not a room`);
  const evIds = new Set(def.evidence.map((e) => e.id));
  for (const id of p.startingEvidenceIds ?? [])
    if (!evIds.has(id)) note("high", `startingEvidenceIds references unknown "${id}"`);
  checks.push({
    check: "starting_state_resolves",
    verdict: findings.some((f) => f.severity === "high") ? "fail" : "pass",
    note: `starts at ${p.startingLocationId} with ${(p.startingEvidenceIds ?? []).length} items`,
  });
  if (!p.briefing) note("medium", "no briefing/dossier authored — the player opens cold");

  // 2. The three questions (LLM): why there, what role, does it make sense
  let report = null;
  if (llm) {
    report = await askJson(`You audit the PLAYER PERSONA of an interactive mystery. The player inhabits this
character; judge whether the setup justifies their involvement. Setting: ${JSON.stringify(def.meta?.setting)}
(${def.meta?.theme}, ${def.meta?.tone}). Premise: ${JSON.stringify(def.meta?.premise)}

PERSONA:
${JSON.stringify(p, null, 1)}

CASE SHAPE (for judging fit — sealed truth included):
solution summary: ${JSON.stringify(def.solution?.summary)}
endings: ${JSON.stringify((def.endings ?? []).map((e) => ({ id: e.id, when: e.when, title: e.title })))}
cast: ${JSON.stringify(def.characters.map((c) => ({ id: c.id, role: c.storyRole, name: c.name })))}
time: ${JSON.stringify(def.time ?? null)}
beats (world pressure — deadlines, counterplay, consequences):
${JSON.stringify((def.beats ?? []).map((b) => ({ id: b.id, trigger: b.trigger, hint: (b.narrationHints ?? "").slice(0, 160) })), null, 1)}

DESIGN PHILOSOPHY you are enforcing: the persona is a TRANSPARENT AVATAR. The player IS the
character and brings their own personality; the persona exists only to justify presence,
access, and objective. Backstory, scripted emotions, or a personality the player must perform
are DEFECTS, not depth. Stakes must live in the SITUATION (deadlines, consequences in the
world), never in an authored inner life.

Grade each check pass | strain | fail, with a one-sentence note and, where not pass, a concrete fix:

- summons_plausible: WHY ARE THEY THERE — the in-world reason this person is present, alone,
  now; does arrival logistics survive scrutiny (weather, distance, timing)?
- role_grants_access: WHAT IS THEIR ROLE — does role/authority explain what the game lets them
  do (question anyone, search rooms, make accusations that stick)? Mismatch between social
  standing and assumed access is the classic hole.
- knowledge_stance_consistent: does startingKnowledge/briefing match who they are (a stranger
  must not start knowing private facts; a local must not need their own world explained)?
- stakes_situational: does the SITUATION make the outcome matter — a deadline, a consequence,
  a cost in the world if the player fails or is wrong? (Judge the world's pressure, not the
  avatar's feelings. An authored personal wound does NOT satisfy this check.)
- avatar_transparency: is the persona thin enough to inhabit? Fail if it scripts emotions,
  heavy backstory, or a personality the player must perform. ALSO fail if it authors a
  personal name (the correct form of address is a role title — "Inspector", "Doctor"), a
  face/age description, or a fixed gender: the player is addressed as "you" plus title, has
  no portrait, and brings their own self. Clothing, carried objects, and bearing are fine.
  Pass when it gives role, address title, voice register, and reputation — then gets out
  of the way.
- objective_actionable: is the stated objective concrete, achievable, and matched to how the
  case actually scores (identity + how + why)?
- household_tension: do the NPCs have an authored reason to resist, tolerate, or court this
  persona (publicPerception doing real work)?

Reply JSON:
{
 "checks": [{"id": "summons_plausible", "verdict": "pass|strain|fail", "note": "...", "fix": "..."}],
 "why_there": "one-sentence restatement of the persona's reason for presence",
 "role": "one-sentence restatement of the persona's role and authority",
 "overall": "sound|strained|broken"
}`);
    for (const c of report.checks ?? []) {
      checks.push({
        check: `persona:${c.id}`,
        verdict: c.verdict === "pass" ? "pass" : c.verdict === "strain" ? "warn" : "fail",
        note: c.note + (c.fix && c.verdict !== "pass" ? ` (fix: ${c.fix})` : ""),
      });
    }
  }

  return { audit: "persona", grade: gradeOf(checks, findings), checks, findings, report };
}
