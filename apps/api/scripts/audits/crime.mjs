/**
 * Crime audit — does the crime SEQUENCE hold (means, opportunity, physics,
 * timeline, concealment) and does the villain's MOTIVE hold (specific,
 * proportional, triggered)? Strict per-check verdicts with citations from
 * canon, so two runs argue about the same lines, not vibes.
 */
import { askJson, gradeOf } from "./shared.mjs";

export async function runCrimeAudit(def, { llm = true } = {}) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });

  // 1. Deterministic: timeline order sanity (parseable years must not regress)
  const tl = def.canon?.timeline ?? [];
  let lastYear = -Infinity;
  for (const e of tl) {
    const m = /^(1[0-9]{3}|20[0-9]{2})\b/.exec(e.at ?? "");
    if (!m) continue;
    const y = Number(m[1]);
    if (y < lastYear) note("medium", `canon "${e.id}" (${e.at}) appears after a later year in the timeline array`);
    lastYear = Math.max(lastYear, y);
  }
  checks.push({
    check: "timeline_order",
    verdict: findings.length ? "warn" : "pass",
    note: `${tl.length} canon events; dated events in order`,
  });

  // 2. LLM: strict rubric over the sealed truth
  let rubric = null;
  if (llm) {
    rubric = await askJson(`You are a forensic continuity editor. Below is the SEALED TRUTH of a mystery
(canon timeline + solution + relevant cast constraints). Audit whether the crime and its motive
actually hold together. You are NOT judging fun — only whether events could happen as written
and whether the villain's reasoning survives cross-examination.

CANON TIMELINE:
${JSON.stringify(tl, null, 1)}

SOLUTION:
${JSON.stringify(def.solution, null, 1)}

CAST CONSTRAINTS (physical/positional facts that events must respect):
${JSON.stringify(def.characters.map((c) => ({ id: c.id, role: c.storyRole, bio: c.shortBio })), null, 1)}

Grade EACH check pass | strain | fail. "strain" = requires generosity but a genre reader accepts it;
"fail" = a careful reader catches it. EVERY verdict must cite the canon event id(s) it rests on.

Checks:
- motive_specific: motive belongs to THIS villain (not generic greed)
- motive_proportional: the stakes justify the crime in the villain's own arithmetic
- trigger_why_now: something concrete forces action NOW
- means_available: every physical action uses means the actor demonstrably has
- opportunity_real: actors are where they must be, unobserved, with time enough
- physics_consistent: wounds match weapons, movements match bodies (age, strength, disability), objects behave
- timeline_coherent: no event needs knowledge or materials from a later event
- plan_survivable: the plan tolerates likely deviations (or the villain owns the gamble in canon)
- concealment_holds: why nothing surfaced before the story starts is explained by the canon itself
- discovery_logic: what the player CAN find exists for reasons inside the world, not authorial gift

Reply JSON:
{
 "checks": [{"id": "motive_specific", "verdict": "pass|strain|fail", "cite": ["event-id"], "note": "..."}],
 "contradictions": ["...each a specific clash between two cited events..."],
 "overall": "sound|strained|broken"
}`);
    for (const c of rubric.checks ?? []) {
      checks.push({
        check: `crime:${c.id}`,
        verdict: c.verdict === "pass" ? "pass" : c.verdict === "strain" ? "warn" : "fail",
        note: `${c.note} [${(c.cite ?? []).join(", ")}]`,
      });
    }
    for (const c of rubric.contradictions ?? []) note("high", `contradiction: ${c}`);
  }

  return { audit: "crime", grade: gradeOf(checks, findings), checks, findings, overall: rubric?.overall };
}
