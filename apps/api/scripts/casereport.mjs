#!/usr/bin/env node
/**
 * Case report card — one command, every QA layer, ranked weak points
 * (docs/MYSTERY_PRINCIPLES.md).
 *
 *   pnpm casereport --case blackwood-inheritance
 *   pnpm casereport --case blackwood-inheritance --no-story   # skip LLM pass
 *
 * Aggregates:
 *   1. World budget arithmetic (locations/characters vs pacing band)
 *   2. Static analysis (dead locations via lintBundle, ungated secrets,
 *      evidence spread, red herrings, suspect depth)
 *   3. Story QA (four WHYs, six WHATs, three HOWs, contradictions)
 *   4. Latest playtest evidence per persona (version-matched)
 *
 * Writes playtests/<case>/report-<version>-<stamp>.md and prints a
 * condensed version. This is the "what should we improve" artifact.
 */
import { config as loadEnv } from "dotenv";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runStorycheck, storycheckModel } from "./storycheck.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: join(repoRoot, ".env") });

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith("--")) {
    const k = process.argv[i].slice(2);
    args[k] =
      i + 1 < process.argv.length && !process.argv[i + 1].startsWith("--")
        ? process.argv[++i]
        : "true";
  }
}
const CASE_ID = args.case;
if (!CASE_ID) {
  console.error("Usage: pnpm casereport --case <caseId> [--no-story]");
  process.exit(1);
}

const def = JSON.parse(
  readFileSync(join(repoRoot, "content/cases", CASE_ID, "definition.json"), "utf8")
);
const V = def.contentVersion;

const PACING_BANDS = { easy: [12, 35], medium: [18, 45], hard: [25, 60] };
const band = def.meta.playtest?.maxTurns
  ? [def.meta.playtest.minTurns ?? 12, def.meta.playtest.maxTurns]
  : (PACING_BANDS[def.meta.difficulty ?? "medium"] ?? PACING_BANDS.medium);

/** severity: high | medium | info */
const weakPoints = [];
const note = (severity, area, text) => weakPoints.push({ severity, area, text });

// ── 1. World budget ──────────────────────────────────────────────────

const living = def.characters.filter((c) => c.storyRole !== "victim");
// Suspects demand full interrogation arcs (~3 turns); witnesses and
// support carry one or two key testimonies (~1.5).
const castCost = living.reduce(
  (sum, c) => sum + (c.storyRole === "suspect" ? 3 : 1.5),
  0
);
const budget = Math.round(def.locations.length * 3 + castCost);
const bandMid = Math.round((band[0] + band[1]) / 2);
const budgetVerdict =
  budget < band[0] ? "thin" : budget > band[1] ? "oversized" : "in band";
if (budgetVerdict === "thin") {
  note(
    "high",
    "world budget",
    `content budget ${budget} turns (${def.locations.length} locations, ${living.length} living characters) is below the pacing floor ${band[0]} — the world is too small for its own band`
  );
} else if (budgetVerdict === "oversized") {
  note(
    "medium",
    "world budget",
    `content budget ${budget} exceeds the band ceiling ${band[1]} — expect wasted travel/exploration`
  );
}

// ── 2. Static analysis ───────────────────────────────────────────────

// Dead locations (reuse the bundle linter).
let lintWarnings = [];
try {
  const { lintBundle } = await import("../dist/bundle.js");
  const { parseMysteryDefinition } = await import("@mystery/shared");
  lintWarnings = lintBundle(parseMysteryDefinition(def));
} catch (err) {
  lintWarnings = [`lint unavailable (build apps/api first): ${err.message}`];
}
for (const w of lintWarnings) {
  note(w.includes("dead weight") || w.includes("leak") ? "high" : "medium", "lint", w);
}

// Ungated secrets: private/secret knowledge with no requirements folds
// under a single question (the "Vale folds too easily" pattern).
const ungated = [];
for (const c of def.characters) {
  for (const lvl of ["private", "secrets"]) {
    for (const k of c.knowledge?.[lvl] ?? []) {
      const gated = Object.keys(k).some((key) => key.startsWith("requires"));
      if (!gated) ungated.push(`${c.id}.${k.id}`);
    }
  }
}
if (ungated.length) {
  note(
    "medium",
    "gates",
    `ungated private/secret knowledge (freely shared once willing): ${ungated.join(", ")}`
  );
}

// Suspect depth: living non-victim characters with nothing beneath the surface.
const shallow = living.filter(
  (c) =>
    (c.knowledge?.private?.length ?? 0) + (c.knowledge?.secrets?.length ?? 0) === 0
);
if (shallow.length) {
  note(
    "medium",
    "cast",
    `characters with no private/secret depth: ${shallow.map((c) => c.id).join(", ")} — nothing for suspicion or discovery to live on`
  );
}

// Evidence spread + red herrings.
const evidenceLocs = new Set(
  def.evidence.map((e) => e.discoverableAt?.locationId).filter(Boolean)
);
if (evidenceLocs.size < Math.min(3, def.locations.length)) {
  note(
    "medium",
    "evidence",
    `discoverable evidence clusters in ${evidenceLocs.size} location(s) of ${def.locations.length} — the tour isn't required`
  );
}
const redHerrings = def.evidence.filter((e) => e.redHerring);
if (redHerrings.length === 0) {
  note("medium", "evidence", "no authored red-herring evidence — deflection has no physical anchor");
}

// Rubric facets.
const facets = def.solution.rubric?.requiredFacts ?? [];
if (facets.length < 3) {
  note("medium", "rubric", `only ${facets.length} rubric facets — accusations have little to be scored against`);
}

// ── 3. Story QA (LLM) ────────────────────────────────────────────────

let story = null;
if (args["no-story"] !== "true") {
  console.log(`Story QA via ${storycheckModel()}…`);
  try {
    story = await runStorycheck(def);
    for (const w of story.whys ?? []) {
      if (w.verdict !== "solid") note("high", "story", `${w.question} [${w.verdict}]: ${w.fix ?? w.analysis}`);
    }
    for (const w of story.whats ?? []) {
      if (w.verdict !== "solid") note("high", "story", `${w.question} [${w.verdict}]: ${w.fix ?? w.answer}`);
    }
    for (const c of story.contradictions ?? []) note("high", "canon", c);
    for (const c of story.checklist ?? []) {
      if (!c.pass) note("high", "principles", `${c.item}: ${c.notes}`);
    }
  } catch (err) {
    note("info", "story", `story QA failed: ${err.message}`);
  }
}

// ── 4. Playtest evidence ─────────────────────────────────────────────

const ptDir = join(repoRoot, "playtests", CASE_ID);
const latestByPersona = new Map();
if (existsSync(ptDir)) {
  for (const d of readdirSync(ptDir).sort()) {
    const evalPath = join(ptDir, d, "eval.json");
    if (!existsSync(evalPath)) continue;
    try {
      const e = JSON.parse(readFileSync(evalPath, "utf8"));
      latestByPersona.set(e.persona, e); // sorted dirs → last wins
    } catch {
      /* skip */
    }
  }
}
const playtests = [...latestByPersona.values()];
const current = playtests.filter((p) => p.contentVersion === V);
if (!playtests.length) {
  note("info", "playtests", "no playtest runs on record — run pnpm playtest --sweep");
} else if (!current.length) {
  note(
    "info",
    "playtests",
    `no playtests for current version ${V} (latest runs are ${[...new Set(playtests.map((p) => p.contentVersion))].join(", ")}) — re-sweep before trusting them`
  );
}
for (const p of current) {
  const e = p.eval ?? {};
  if (e.pacing?.verdict && e.pacing.verdict !== "in_band")
    note("high", "playtest", `${p.persona}: pacing ${e.pacing.verdict} (${p.metrics.turns} turns vs band ${band[0]}-${band[1]})`);
  if (e.leaks?.found) note("high", "playtest", `${p.persona}: leak reported — ${e.leaks.notes}`);
  if ((e.fun_score ?? 10) < (def.meta.playtest?.minFunMedian ?? 7))
    note("medium", "playtest", `${p.persona}: fun ${e.fun_score}/10 below target`);
  if (e.content_density?.verdict === "thin")
    note("medium", "playtest", `${p.persona}: content density thin — ${e.content_density.notes}`);
}

// ── Report ───────────────────────────────────────────────────────────

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const order = { high: 0, medium: 1, info: 2 };
weakPoints.sort((a, b) => order[a.severity] - order[b.severity]);

const md = [];
md.push(`# Case report — ${def.meta.title} (${CASE_ID}@${V})`);
md.push(`Generated ${stamp} · difficulty ${def.meta.difficulty ?? "medium"} · band ${band[0]}-${band[1]} turns`);
md.push("");
md.push(`## Overview`);
md.push(`| | |`);
md.push(`|---|---|`);
md.push(`| Locations | ${def.locations.length} |`);
md.push(`| Characters (living) | ${living.length} of ${def.characters.length} |`);
md.push(`| Evidence | ${def.evidence.length} (${redHerrings.length} red herring) across ${evidenceLocs.size} locations |`);
md.push(`| Beats | ${(def.beats ?? []).length} |`);
md.push(`| Rubric facets | ${facets.length} (${def.solution.rubric?.successPolicy}) |`);
md.push(`| World budget | ${budget} turns of content vs band ${band[0]}-${band[1]} → **${budgetVerdict}** (band midpoint ${bandMid}) |`);
md.push("");
if (story) {
  md.push(`## Story QA (${storycheckModel()})`);
  md.push(`Overall grade: **${story.overall?.grade ?? "?"}**`);
  md.push("");
  md.push(`| Question | Verdict | Notes |`);
  md.push(`|---|---|---|`);
  for (const w of [...(story.whys ?? []), ...(story.whats ?? [])]) {
    md.push(`| ${w.question} | ${w.verdict} | ${(w.analysis ?? w.answer ?? "").replaceAll("|", "/")} |`);
  }
  md.push("");
  if (story.contradictions?.length) {
    md.push(`### Canon contradictions`);
    for (const c of story.contradictions) md.push(`- ⚠ ${c}`);
    md.push("");
  }
}
if (playtests.length) {
  md.push(`## Playtest evidence (latest per persona)`);
  md.push(`| Persona | Version | Turns | Outcome | Fun | Pacing | Leaks |`);
  md.push(`|---|---|---|---|---|---|---|`);
  for (const p of playtests) {
    const stale = p.contentVersion === V ? "" : " ⚠stale";
    md.push(
      `| ${p.persona} | ${p.contentVersion}${stale} | ${p.metrics.turns} | ${p.metrics.finalStatus} | ${p.eval?.fun_score ?? "?"} | ${p.eval?.pacing?.verdict ?? "?"} | ${p.eval?.leaks?.found ? "YES" : "no"} |`
    );
  }
  md.push("");
}
md.push(`## Weak points (ranked)`);
if (!weakPoints.length) md.push(`None found — run a fresh sweep to confirm.`);
for (const w of weakPoints) {
  md.push(`- **[${w.severity}] ${w.area}** — ${w.text}`);
}
md.push("");
if (story?.hows?.length) {
  md.push(`## Improvement menu (from story QA)`);
  for (const h of story.hows) {
    md.push(`### ${h.question}`);
    for (const s of h.suggestions ?? []) md.push(`- ${s}`);
  }
  md.push("");
}
if (story?.overall?.top_fixes?.length) {
  md.push(`## Top fixes`);
  for (const f of story.overall.top_fixes) md.push(`1. ${f}`);
}

mkdirSync(ptDir, { recursive: true });
const outPath = join(ptDir, `report-${V}-${stamp}.md`);
writeFileSync(outPath, md.join("\n"));

// ── Console summary ──────────────────────────────────────────────────

console.log(`\n═══ Case report — ${def.meta.title} (${CASE_ID}@${V}) ═══`);
console.log(
  `  world: ${def.locations.length} locations, ${living.length} living characters, ${def.evidence.length} evidence → budget ${budget} vs band ${band[0]}-${band[1]} (${budgetVerdict})`
);
if (story) console.log(`  story QA: ${story.overall?.grade ?? "?"}`);
if (playtests.length) {
  for (const p of playtests) {
    const stale = p.contentVersion === V ? "" : " (stale)";
    console.log(
      `  playtest ${p.persona}${stale}: ${p.metrics.turns}t, fun ${p.eval?.fun_score ?? "?"}, ${p.eval?.pacing?.verdict ?? "?"}`
    );
  }
}
console.log(`\n  Weak points:`);
if (!weakPoints.length) console.log(`  (none)`);
for (const w of weakPoints) console.log(`  [${w.severity}] ${w.area} — ${w.text}`);
console.log(`\n  report: ${outPath.replace(repoRoot + "/", "")}`);
