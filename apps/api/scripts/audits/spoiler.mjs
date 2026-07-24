/**
 * Spoiler audit — does any player-facing copy give away a secret the player
 * is meant to DISCOVER? Two layers:
 *
 *   Deterministic (always): scans the "front matter" a player sees before
 *   earning anything (premise, theMystery, objective, opening, briefing,
 *   starting knowledge, and the player-facing deduction QUESTIONS) for
 *   (a) universal twist words, (b) multi-word answer phrases lifted straight
 *   from the rubric's matchHints, and (c) distinctive passages copied out of
 *   the SEALED solution prose.
 *
 *   LLM (when enabled): reads the sealed solution against the same copy and
 *   flags the subtle leaks a word list can't — e.g. framing a mid-game reveal
 *   ("what is the ship really carrying?") as an up-front goal.
 *
 * The cover story is NOT a spoiler: the staged appearance, the public facts,
 * and the questions the player is meant to ask are all fair to show. Only the
 * things behind the curtain — the culprit's guilt, the method, the motive,
 * the twist — must stay hidden until earned. (docs/MYSTERY_PRINCIPLES.md)
 */
import { askJson, gradeOf } from "./shared.mjs";

/** Universal reveal markers — almost always a spoiler if seen up front. */
const REVEAL_WORDS = [
  "suicide",
  "self-inflicted",
  "killed himself",
  "killed herself",
  "took his own life",
  "took her own life",
  "stage his own",
  "stage her own",
  "staged his own",
  "staged her own",
  "stages his own",
  "stages her own",
  "staged the",
  "framed",
  "frame-up",
  "faked his",
  "faked her",
  "fake death",
  "faked death",
  "not really dead",
  "still alive",
  "the real killer",
  "real culprit",
  "the culprit is",
  "actually the killer",
  "secretly",
  "operative",
  "double agent",
  "accomplice",
  "inside job",
  "was not murdered",
  "no murder at all",
];

/** Word-boundary-ish membership (so "operative" ≠ "cooperative"). */
function containsTerm(text, term) {
  const esc = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`, "i").test(text.toLowerCase());
}

function shingles(text, n) {
  const w = (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

/** Copy a player sees WITHOUT having earned a discovery. */
function frontMatter(def) {
  const out = [];
  const push = (field, text) => {
    if (text && String(text).trim()) out.push({ field, text: String(text) });
  };
  const m = def.meta ?? {};
  for (const k of ["premise", "theMystery", "setting", "tagline", "hook"]) push(`meta.${k}`, m[k]);
  const p = def.player ?? {};
  for (const k of ["objective", "background", "publicPerception", "startingKnowledge"]) {
    push(`player.${k}`, p[k]);
  }
  push("openingNarration", def.openingNarration);
  const b = p.briefing;
  if (b) {
    push("briefing.title", b.title);
    (b.sections ?? []).forEach((s, i) =>
      push(`briefing.sections[${i}]`, `${s.heading ?? ""} ${s.text ?? ""}`)
    );
  }
  return out;
}

/** Surfaces a player meets early but not at the very start (for the LLM scan). */
function earlyVisible(def) {
  const out = [];
  const push = (field, text) => {
    if (text && String(text).trim()) out.push({ field, text: String(text) });
  };
  for (const c of def.characters ?? []) {
    if (c.knownAtStart === false) continue;
    push(`character.${c.id}.shortBio`, c.shortBio);
    push(`character.${c.id}.cardTitle`, c.cardTitle);
    push(`character.${c.id}.public`, c.knowledge?.public);
  }
  for (const l of def.locations ?? []) {
    if (l.knownAtStart === false) continue;
    push(`location.${l.id}.description`, l.description);
  }
  return out;
}

export async function runSpoilerAudit(def, { llm = true } = {}) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });

  const front = frontMatter(def);
  const early = earlyVisible(def);
  // Everything a player can read without earning a discovery: the narration
  // front matter AND the cast cards / known-location descriptions. Both the
  // deterministic word/phrase checks and the LLM scan run over all of it.
  const scanned = [...front, ...early];

  // Distinctive (≥3-word) answer phrases from the rubric. Single/short hints
  // ("airlock", "colony", "his own", "no murder") legitimately live in the
  // cover story, so only longer, answer-shaped phrases are treated as leaks.
  const answerPhrases = new Set();
  for (const f of def.solution?.rubric?.requiredFacts ?? []) {
    for (const h of f.matchHints ?? []) {
      const hh = h.trim().toLowerCase();
      if (hh.split(/\s+/).length >= 3) answerPhrases.add(hh);
    }
  }

  // ── 1. reveal words / answer phrases in front matter ──────────────────
  const revealHits = [];
  const phraseHits = [];
  for (const { field, text } of scanned) {
    for (const w of REVEAL_WORDS) if (containsTerm(text, w)) revealHits.push({ field, term: w });
    for (const ph of answerPhrases) if (containsTerm(text, ph)) phraseHits.push({ field, term: ph });
  }
  checks.push({
    check: "frontmatter_reveal_terms",
    verdict: revealHits.length ? "fail" : phraseHits.length ? "warn" : "pass",
    note:
      revealHits.length || phraseHits.length
        ? [...revealHits, ...phraseHits]
            .slice(0, 6)
            .map((h) => `${h.field}: "${h.term}"`)
            .join("; ")
        : "no twist words or answer phrases in front matter or cast cards",
  });
  for (const h of revealHits) {
    note("high", `front matter "${h.field}" reveals the twist: contains "${h.term}"`);
  }
  for (const h of phraseHits) {
    note("medium", `front matter "${h.field}" states an answer phrase: "${h.term}"`);
  }

  // ── 2. distinctive passages copied out of the sealed solution ─────────
  const sealedText = [
    def.solution?.summary,
    def.solution?.method,
    def.solution?.motive,
    def.revelation,
    def.canon?.notes,
    ...(def.deductions ?? []).map((d) => d.claim),
    ...(def.characters ?? []).flatMap((c) => (c.knowledge?.secrets ?? []).map((s) => s.content)),
  ]
    .filter(Boolean)
    .join("  ");
  const sealedShingles = shingles(sealedText, 7);
  // Only the NARRATION front matter is checked for copied solution prose:
  // cast cards and location descriptions legitimately share factual wording
  // with the sealed solution (which explains the world's own clues and
  // characters), so scanning them here just flags fair clues as leaks.
  const copied = [];
  for (const { field, text } of front) {
    for (const s of shingles(text, 7)) {
      if (sealedShingles.has(s)) copied.push({ field, phrase: s });
    }
  }
  checks.push({
    check: "frontmatter_sealed_phrases",
    verdict: copied.length ? "warn" : "pass",
    note: copied.length
      ? copied.slice(0, 4).map((c) => `${c.field}: "…${c.phrase}…"`).join("; ")
      : "no distinctive passage copied from the sealed solution",
  });
  for (const c of copied) {
    note("medium", `front matter "${c.field}" reuses sealed-solution wording: "…${c.phrase}…"`);
  }

  // ── 3. player-facing deduction QUESTIONS must pose, not answer ────────
  const leakyQuestions = [];
  for (const d of def.deductions ?? []) {
    const q = d.question ?? "";
    for (const w of REVEAL_WORDS) if (containsTerm(q, w)) leakyQuestions.push({ id: d.id, term: w });
    for (const ph of answerPhrases) if (containsTerm(q, ph)) leakyQuestions.push({ id: d.id, term: ph });
  }
  checks.push({
    check: "deduction_questions_open",
    verdict: leakyQuestions.length ? "warn" : "pass",
    note: leakyQuestions.length
      ? leakyQuestions.slice(0, 6).map((h) => `${h.id}: "${h.term}"`).join("; ")
      : "player-facing questions pose the mystery without stating answers",
  });
  for (const h of leakyQuestions) {
    note("medium", `deduction "${h.id}" question hints its own answer: "${h.term}"`);
  }

  // ── 4. LLM scan for subtle "points at a secret" leaks ─────────────────
  let report = null;
  if (llm) {
    const surfaces = scanned;
    report = await askJson(`You audit an interactive mystery for SPOILERS in player-facing copy.

A spoiler is any player-facing text that reveals, states, or steers the player toward a
secret they are meant to DISCOVER during play. Spoilers include:
 • naming the culprit as guilty, or stating they are lying / behind it;
 • stating the METHOD or the MOTIVE;
 • revealing the TWIST (e.g. that a death is a suicide, that it was staged or framed, that a
   character is secretly something, that an object is not what it seems);
 • framing a mid-game REVEAL as an up-front goal — e.g. telling the player their objective is
   to "find out what the ship is really carrying" when the cargo's true nature is the twist.

NOT spoilers (do not flag these): the cover story and staged appearance; the public facts any
bystander would know; the honest questions the player is meant to ask; and setting vocabulary
(ship, airlock, colony, manor…) used without giving anything away. The surface mystery is
SUPPOSED to share words with the solution — only flag copy that tips what's behind the curtain.

SEALED SOLUTION (never shown to players — this is what must stay hidden):
${JSON.stringify(
  {
    guilty: def.solution?.guiltyPartyIds,
    summary: def.solution?.summary,
    method: def.solution?.method,
    motive: def.solution?.motive,
    twist: def.canon?.notes ?? def.revelation,
  },
  null,
  1
)}

WHAT THE PLAYER LEGITIMATELY KNOWS AT START (the fair baseline — not a spoiler):
${JSON.stringify(def.player?.startingKnowledge ?? "")}

PLAYER-FACING COPY TO AUDIT (field → text):
${JSON.stringify(surfaces, null, 1)}

BE EXHAUSTIVE. Work through EVERY field in the list one by one, and test each field against
EVERY secret in the sealed solution above (guilt, method, motive, and the twist). Report ALL
genuine leaks — however small, however many — not just the most obvious few; a single missed
span ships a spoiler. Pay special attention to cast-card bios and titles (character.*.shortBio,
cardTitle, public), which leak plot facts as easily as the narration does. When you think you
are done, re-scan the whole list once more for anything you skipped. It is better to over-report
a borderline span (mark it low) than to miss a real leak.

For each genuine leak, quote the exact offending span and say which secret it gives away.
Reply JSON:
{
 "leaks": [
   {"field": "<field id>", "quote": "<exact offending text>", "reveals": "<the secret it tips>", "severity": "high|medium|low", "fix": "<how to de-spoiler it>"}
 ],
 "overall": "clean|leaky"
}`, { temperature: 0 });
    const leaks = report?.leaks ?? [];
    checks.push({
      check: "llm_spoiler_scan",
      verdict: leaks.some((l) => l.severity === "high")
        ? "fail"
        : leaks.length
          ? "warn"
          : "pass",
      note: leaks.length
        ? `${leaks.length} leak(s): ${leaks.slice(0, 4).map((l) => l.field).join(", ")}`
        : "no copy reveals or points at a hidden secret",
    });
    for (const l of leaks) {
      const sev = l.severity === "high" ? "high" : l.severity === "low" ? "info" : "medium";
      note(
        sev,
        `${l.field}: "${l.quote}" — tips ${l.reveals}${l.fix ? ` (fix: ${l.fix})` : ""}`
      );
    }
  }

  return { audit: "spoiler", grade: gradeOf(checks, findings), checks, findings, report };
}
