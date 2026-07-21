#!/usr/bin/env node
/**
 * Per-dimension mystery audits — objective where possible, rubric'd where not.
 *
 *   pnpm audit --case blackwood-inheritance                 # all five
 *   pnpm audit --case blackwood-inheritance --audit clues,locations
 *   pnpm audit --case blackwood-inheritance --no-llm        # deterministic checks only
 *
 * Audits: crime | realism | characters | locations | clues
 * Each saves playtests/<case>/audit-<name>-<version>-<stamp>.json and prints
 * a report. Exit 1 if any audit grades FAIL.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { auditModel, printAudit, repoRoot } from "./shared.mjs";
import { runCrimeAudit } from "./crime.mjs";
import { runRealismAudit } from "./realism.mjs";
import { runCharactersAudit } from "./characters.mjs";
import { runLocationsAudit } from "./locations.mjs";
import { runCluesAudit } from "./clues.mjs";
import { runPersonaAudit } from "./persona.mjs";
import { runOpeningAudit } from "./opening.mjs";
import { runEndingAudit } from "./ending.mjs";

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
  console.error("Usage: pnpm audit --case <caseId> [--audit crime,realism,characters,locations,clues] [--no-llm]");
  process.exit(1);
}

const caseDir = join(repoRoot, "content/cases", args.case);
const def = JSON.parse(readFileSync(join(caseDir, "definition.json"), "utf8"));
const llm = args["no-llm"] !== "true";
const wanted = (args.audit ?? "all") === "all"
  ? ["crime", "realism", "characters", "locations", "clues", "persona", "opening", "ending"]
  : args.audit.split(",").map((s) => s.trim());

const RUNNERS = {
  crime: () => runCrimeAudit(def, { llm }),
  realism: () => runRealismAudit(def, { llm }),
  characters: () => runCharactersAudit(def, { llm, caseDir }),
  locations: () => runLocationsAudit(def, { llm }),
  clues: () => runCluesAudit(def),
  persona: () => runPersonaAudit(def, { llm }),
  opening: () => runOpeningAudit(def, { llm }),
  ending: () => runEndingAudit(def, { llm }),
};

const label = `${args.case}@${def.contentVersion}`;
console.log(`Audits [${wanted.join(", ")}] on "${def.meta.title}" (${label})${llm ? ` via ${auditModel()}` : " (no LLM)"}…`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = join(repoRoot, "playtests", args.case);
mkdirSync(dir, { recursive: true });

let anyFail = false;
const summary = [];
// LLM audits run concurrently; clues/locations are instant anyway.
const results = await Promise.all(
  wanted.map(async (name) => {
    if (!RUNNERS[name]) throw new Error(`unknown audit "${name}"`);
    return [name, await RUNNERS[name]()];
  })
);
for (const [name, report] of results) {
  printAudit(report, label);
  const out = join(dir, `audit-${name}-${def.contentVersion}-${stamp}.json`);
  writeFileSync(out, JSON.stringify({ case: args.case, contentVersion: def.contentVersion, report }, null, 2));
  summary.push(`${name}=${report.grade}`);
  if (report.grade === "fail") anyFail = true;
}
console.log(`\n${"═".repeat(50)}\n  ${summary.join("  ")}\n  reports saved under playtests/${args.case}/`);
if (anyFail) process.exitCode = 1;
