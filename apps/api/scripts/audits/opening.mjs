/**
 * Opening audit — the fixed story start. Checks the FLOOR, not the
 * ceiling: bearings present (where / why me / what's wrong), one live
 * spark, nothing the persona couldn't know — and RESTRAINT. An opening
 * that over-explains fails; discovery is the product
 * (docs/MYSTERY_PRINCIPLES.md §8e).
 */
import { askJson, gradeOf } from "./shared.mjs";

export async function runOpeningAudit(def, { llm = true } = {}) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });

  // 1. A fixed, authored start exists and is spark-sized
  const opening = def.openingNarration ?? "";
  const words = opening.split(/\s+/).filter(Boolean).length;
  checks.push({
    check: "opening_authored",
    verdict: !words ? "fail" : "pass",
    note: words ? `${words} words of fixed prose (never runtime-generated)` : "no openingNarration",
  });
  if (words > 0 && words < 40) note("medium", `opening is ${words} words — too thin to give bearings`);
  if (words > 300) note("medium", `opening is ${words} words — briefing has crept into the spark`);

  // 2. The starting room is live: something to touch, someone to talk to
  const start = def.locations.find((l) => l.id === def.player?.startingLocationId);
  const handles =
    (start?.inspectables ?? []).length +
    def.characters.filter((c) => c.defaultLocationId === start?.id && c.storyRole !== "victim").length;
  checks.push({
    check: "starting_room_live",
    verdict: handles >= 2 ? "pass" : handles === 1 ? "warn" : "fail",
    note: `${(start?.inspectables ?? []).length} inspectables + ${handles - (start?.inspectables ?? []).length} people at ${start?.id}`,
  });

  // 3. The floor questions (LLM)
  let report = null;
  if (llm) {
    report = await askJson(`You audit the OPENING of an interactive mystery against this philosophy:
"Bearings, not briefing." The opening gives three answers (where am I, why am I here, what's
wrong), one concrete oddity to snag on, and then gets out of the way. Every fact handed over
up front is a fact the player can no longer DISCOVER — and discovery is the product. Gaps are
invitations. Over-explaining is a defect. (Touchstone: Colonel's Bequest — you arrive knowing
almost nothing and the not-knowing powers the first hour.)

FIXED OPENING NARRATION (what every player sees first):
${JSON.stringify(opening)}

PERSONA (what this person could plausibly know on arrival):
${JSON.stringify({ role: def.player?.role, authority: def.player?.authority, startingKnowledge: def.player?.startingKnowledge })}

OPT-IN BRIEFING (re-readable dossier, NOT required reading):
${JSON.stringify(def.player?.briefing ?? null)}

STARTING ROOM:
${JSON.stringify({ id: start?.id, description: start?.description, inspectables: (start?.inspectables ?? []).map((i) => i.name) })}

SEALED SOLUTION (for leak-checking only):
${JSON.stringify(def.solution?.summary)}

Grade each check pass | strain | fail with a one-sentence note (and fix when not pass).
Judge the NARRATION alone for bearings/spark — the briefing is opt-in and must not be required:

- bearings: from the narration alone, can the player answer where they are, why they're
  here, and what's wrong — in rough strokes? (Rough is enough; full orientation NOT required.)
- spark: is there at least one concrete oddity that invites poking — an image the mind
  snags on, not a stated task? Name it.
- restraint: does the opening WITHHOLD well? Fail if it explains backstory, relationships,
  motives, or hands over facts the player should discover; fail if it reads like a briefing.
  An opening cannot be too mysterious, only too confusing — judge which side it errs on.
- fair_knowledge: nothing in the narration exceeds what this persona could know on arrival,
  and nothing echoes the sealed solution.
- aimed_stop: does it end with the player as the subject — an implicit invitation to act —
  rather than a summary or a list of options?

Reply JSON:
{
 "checks": [{"id": "bearings", "verdict": "pass|strain|fail", "note": "...", "fix": "..."}],
 "spark_named": "the oddity that does the sparking, quoted",
 "overall": "sound|strained|broken"
}`);
    for (const c of report.checks ?? []) {
      checks.push({
        check: `opening:${c.id}`,
        verdict: c.verdict === "pass" ? "pass" : c.verdict === "strain" ? "warn" : "fail",
        note: c.note + (c.fix && c.verdict !== "pass" ? ` (fix: ${c.fix})` : ""),
      });
    }
  }

  return { audit: "opening", grade: gradeOf(checks, findings), checks, findings, report };
}
