#!/usr/bin/env node
/**
 * Story QA — the four WHYs, six WHATs, three HOWs
 * (docs/MYSTERY_PRINCIPLES.md §10).
 *
 *   pnpm storycheck --case blackwood-inheritance
 *
 * A critic model reads the FULL definition (sealed truth included —
 * this is an authoring tool, never player-facing). Also usable as a
 * module: import { runStorycheck } from "./storycheck.mjs".
 */
import { config as loadEnv } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: join(repoRoot, ".env") });

export function storycheckModel() {
  return (
    process.env.PLAYTEST_CRITIC_MODEL ??
    process.env.LLM_NARRATOR_MODEL ??
    "deepseek/deepseek-v4-pro"
  );
}

function buildPrompt(def) {
  return `You are a mystery-fiction editor performing story QA on an interactive
whodunit definition. You can see EVERYTHING, including the sealed solution — judge the
authored story, not the play experience.

Interrogate it with the four WHYs. Accept no shrug for an answer; "because the plot
needs it" is a failing grade.

1. WHY did the villain do it? (motive rooted in THIS person's character/desperation —
   something only they would do, not a generic greed sticker)
2. WHY did they do it the way they did? (is every choice — time, place, method,
   staging — reasonable from the villain's own point of view given what they knew,
   feared, and had available?)
3. WHY isn't it clear who did it and what happened? (the obscurity must have in-world
   causes: staging, innocent noise, exploited assumptions — not authorial fog)
4. WHY hasn't the villain been found out yet? (who already looked before the player
   arrived, why did they fail, why is nobody around the crime implausibly oblivious?)

Then the six WHATs — these test whether the EXPERIENCE was designed. Each demands a
concrete, nameable answer derived from the definition; grade how well the definition
supports it:

1. WHAT makes this story fun? (name the core pleasure — "it's a mystery" fails)
2. WHAT will the player initially think happened? (the designed first theory; if the
   definition doesn't engineer one, deflection was never designed)
3. WHAT is the path to actually solving it? (the intended discovery chain, step by
   step; must exist, be fair, and take more than two links)
4. WHAT is the player's "aha" moment? (the one recognition that collapses the staged
   story)
5. WHAT does the villain do to stop the player? (live opposition; "nothing" passes
   only as a deliberate choice for the gentlest cases)
6. WHAT do the other characters do in response to the investigation? (agendas in
   motion: who obstructs, helps, panics, lies innocently)

Then the three HOWs — generative, even if the case seems done. Give 2-3 concrete,
definition-ready suggestions each:

1. HOW could the characters be more interesting?
2. HOW could locations and items be used better?
3. HOW could there be more twists, deflection, deception, layers?

Also check, strictly from the definition:
- contradictions (timeline vs testimony vs evidence placement vs canon)
- the victim: is anyone hurting? do the stakes exist before the crime is solved?
- does every suspect carry a different story of what the crime means, with a
  discoverable resolution?
- is there a staged story (what the scene was arranged to look like), and does each
  clue expose a seam in it?
- does the villain's plan have a COST that produces evidence?
- do red herrings have real causes and pay something when chased?
- could the case happen only in this setting?

THE DEFINITION:
${JSON.stringify(def, null, 1).slice(0, 60000)}

Return STRICT JSON:
{
  "whys": [
    {"question": "why_did_it", "verdict": "solid"|"weak"|"missing", "analysis": "...", "fix": "..."},
    {"question": "why_this_way", "verdict": ..., "analysis": ..., "fix": ...},
    {"question": "why_unclear", "verdict": ..., "analysis": ..., "fix": ...},
    {"question": "why_not_found_out", "verdict": ..., "analysis": ..., "fix": ...}
  ],
  "whats": [
    {"question": "what_fun", "verdict": "solid"|"weak"|"missing", "answer": "...", "fix": "..."},
    {"question": "what_initial_theory", "verdict": ..., "answer": ..., "fix": ...},
    {"question": "what_solve_path", "verdict": ..., "answer": ..., "fix": ...},
    {"question": "what_aha_moment", "verdict": ..., "answer": ..., "fix": ...},
    {"question": "what_villain_counterplay", "verdict": ..., "answer": ..., "fix": ...},
    {"question": "what_cast_reactions", "verdict": ..., "answer": ..., "fix": ...}
  ],
  "hows": [
    {"question": "how_characters", "suggestions": ["...", "..."]},
    {"question": "how_world", "suggestions": ["...", "..."]},
    {"question": "how_layers", "suggestions": ["...", "..."]}
  ],
  "contradictions": ["..."],
  "checklist": [
    {"item": "victim_stakes", "pass": true|false, "notes": "..."},
    {"item": "suspects_competing_stories", "pass": ..., "notes": ...},
    {"item": "staged_story_with_seams", "pass": ..., "notes": ...},
    {"item": "villain_plan_has_cost", "pass": ..., "notes": ...},
    {"item": "red_herrings_have_causes", "pass": ..., "notes": ...},
    {"item": "setting_specific", "pass": ..., "notes": ...}
  ],
  "overall": {"grade": "ready"|"needs_work"|"broken", "top_fixes": ["...", "..."]}
}`;
}

/** Run the story-QA critic against a parsed definition. Returns the report. */
export async function runStorycheck(def) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY missing from .env");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: storycheckModel(),
      messages: [{ role: "user", content: buildPrompt(def) }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

const MARK = { solid: "✔", weak: "◐", missing: "✘" };

export function printStorycheck(report, label) {
  console.log(`\n═══ Four WHYs — ${label} ═══`);
  for (const w of report.whys ?? []) {
    console.log(`  ${MARK[w.verdict] ?? "?"} ${w.question} [${w.verdict}]`);
    console.log(`      ${w.analysis}`);
    if (w.verdict !== "solid" && w.fix) console.log(`      fix: ${w.fix}`);
  }
  if (report.whats?.length) {
    console.log(`\n═══ Six WHATs ═══`);
    for (const w of report.whats) {
      console.log(`  ${MARK[w.verdict] ?? "?"} ${w.question} [${w.verdict}]`);
      console.log(`      ${w.answer}`);
      if (w.verdict !== "solid" && w.fix) console.log(`      fix: ${w.fix}`);
    }
  }
  if (report.hows?.length) {
    console.log(`\n═══ Three HOWs ═══`);
    for (const h of report.hows) {
      console.log(`  ${h.question}:`);
      for (const s of h.suggestions ?? []) console.log(`    → ${s}`);
    }
  }
  if (report.contradictions?.length) {
    console.log(`\n  Contradictions:`);
    for (const c of report.contradictions) console.log(`  ⚠ ${c}`);
  }
  console.log(`\n  Checklist:`);
  for (const c of report.checklist ?? []) {
    console.log(`  ${c.pass ? "✔" : "✘"} ${c.item}${c.pass ? "" : ` — ${c.notes}`}`);
  }
  console.log(`\n  Overall: ${report.overall?.grade?.toUpperCase() ?? "?"}`);
  for (const f of report.overall?.top_fixes ?? []) console.log(`  → ${f}`);
}

// ── CLI ──────────────────────────────────────────────────────────────

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
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
  if (!args.case) {
    console.error("Usage: pnpm storycheck --case <caseId>");
    process.exit(1);
  }
  const def = JSON.parse(
    readFileSync(join(repoRoot, "content/cases", args.case, "definition.json"), "utf8")
  );
  console.log(
    `Story QA: "${def.meta.title}" (${args.case}@${def.contentVersion}) via ${storycheckModel()}…`
  );
  const report = await runStorycheck(def);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join(repoRoot, "playtests", args.case);
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, `storycheck-${def.contentVersion}-${stamp}.json`);
  writeFileSync(
    outPath,
    JSON.stringify(
      { case: args.case, contentVersion: def.contentVersion, model: storycheckModel(), report },
      null,
      2
    )
  );
  printStorycheck(report, `${args.case}@${def.contentVersion}`);
  console.log(`\n  saved: ${outPath.replace(repoRoot + "/", "")}`);
  if (report.overall?.grade === "broken") process.exitCode = 1;
}
