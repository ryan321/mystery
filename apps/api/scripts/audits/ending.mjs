/**
 * Ending audit — the mask must come off in three stages
 * (docs/MYSTERY_PRINCIPLES.md §8f): a modest in-fiction denouement,
 * an authored revelation that answers the four WHYs for every player
 * including losers, and endings that land on people, not verdicts.
 */
import { askJson, gradeOf } from "./shared.mjs";

export async function runEndingAudit(def, { llm = true } = {}) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });

  // 1. Outcome coverage: success / partial / failure all have authored endings
  const buckets = { success: 0, partial: 0, failure: 0 };
  for (const e of def.endings ?? []) if (e.when in buckets) buckets[e.when]++;
  const missing = Object.entries(buckets).filter(([, n]) => !n).map(([k]) => k);
  checks.push({
    check: "outcome_coverage",
    verdict: missing.length ? "fail" : "pass",
    note: missing.length
      ? `no ending authored for: ${missing.join(", ")}`
      : `${(def.endings ?? []).length} endings over success/partial/failure`,
  });

  // 2. A fixed, authored revelation exists and is chapter-sized
  const rev = def.revelation ?? "";
  const words = rev.split(/\s+/).filter(Boolean).length;
  checks.push({
    check: "revelation_authored",
    verdict: !words ? "fail" : "pass",
    note: words
      ? `${words} words of fixed mask-off prose (never runtime-generated)`
      : "no revelation — the mask never reliably comes off",
  });
  if (words > 0 && words < 150) note("medium", `revelation is ${words} words — the whole story deserves a chapter, not a caption`);

  // 3. LLM: does the revelation actually answer the four WHYs, and do the
  //    endings land on people?
  let report = null;
  if (llm && words) {
    report = await askJson(`You audit the ENDING of an interactive mystery. Philosophy: the in-fiction
denouement stays modest (characters never develop omniscience; only the villain may account
for their own design, in their own nature); the authored REVELATION below is where the whole
truth is told, to every player, even on failed endings.

SEALED CANON (ground truth):
${JSON.stringify(def.canon?.timeline ?? [], null, 1)}
SOLUTION: ${JSON.stringify(def.solution?.summary)}

REVELATION (authored mask-off document shown to every player):
${JSON.stringify(rev)}

ENDINGS (performer guidance per outcome):
${JSON.stringify((def.endings ?? []).map((e) => ({ id: e.id, when: e.when, kind: e.kind, notes: e.templateNotes })), null, 1)}

Grade each check pass | strain | fail with a one-sentence note (fix when not pass):

- why_did_it: does the revelation answer WHY the villain did it, in their specifics?
- why_this_way: does it answer WHY this method — staging, means, constraints?
- why_unclear: does it answer WHY the truth was hard to see (the staged story)?
- why_not_found_out: does it answer WHY nobody caught it before the player?
- revelation_matches_canon: no contradiction between revelation and canon; no invented facts.
- denouement_modest: do the ending notes keep characters in character — confessions only
  where nature permits, no omniscient exposition circles?
- lands_on_people: do the ending notes resolve the PEOPLE (what becomes of them), not just
  the verdict? Failure endings too.
- failure_still_reveals: is the design such that a losing player still gets the truth
  (revelation shown regardless), and do failure notes sting with meaning rather than scold?

Reply JSON:
{
 "checks": [{"id": "why_did_it", "verdict": "pass|strain|fail", "note": "...", "fix": "..."}],
 "overall": "sound|strained|broken"
}`);
    for (const c of report.checks ?? []) {
      checks.push({
        check: `ending:${c.id}`,
        verdict: c.verdict === "pass" ? "pass" : c.verdict === "strain" ? "warn" : "fail",
        note: c.note + (c.fix && c.verdict !== "pass" ? ` (fix: ${c.fix})` : ""),
      });
    }
  }

  return { audit: "ending", grade: gradeOf(checks, findings), checks, findings, report };
}
