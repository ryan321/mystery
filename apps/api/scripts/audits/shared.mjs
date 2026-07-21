/**
 * Shared plumbing for the per-dimension mystery audits.
 * Each audit is runnable on any case definition and returns
 * { audit, grade: "pass"|"warn"|"fail", checks: [...], findings: [...] }.
 */
import { config as loadEnv } from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
loadEnv({ path: join(repoRoot, ".env") });

export function auditModel() {
  return (
    process.env.PLAYTEST_CRITIC_MODEL ??
    process.env.LLM_NARRATOR_MODEL ??
    "deepseek/deepseek-v4-pro"
  );
}

export async function askJson(prompt) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY missing from .env");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: auditModel(),
      messages: [{ role: "user", content: prompt }],
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

/** Flags the engine sets at runtime — never author-declared. */
export const RUNTIME_FLAG_PREFIXES = ["accused_", "falsely_accused_"];
export const isRuntimeFlag = (id) =>
  RUNTIME_FLAG_PREFIXES.some((p) => id.startsWith(p));

const STOP = new Set(
  "the a an of to in on at by for and or with from into over under back down up your his her its their this that where when".split(" ")
);
export function tokens(s) {
  return (s ?? "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

/** Does `text` mention any of the token groups (≥1 token from a group)? */
export function mentionsAny(text, groups) {
  const t = (text ?? "").toLowerCase();
  return groups.some((g) => g.some((tok) => t.includes(tok)));
}

/**
 * Every place a player can hear or read prose: knowledge items, beat
 * narration hints, location descriptions. Used to count signposts.
 */
export function proseSources(def) {
  const out = [];
  for (const c of def.characters) {
    out.push({ kind: "knowledge", ref: `${c.id}/public`, text: c.knowledge?.public ?? "" });
    for (const k of [...(c.knowledge?.private ?? []), ...(c.knowledge?.secrets ?? [])]) {
      out.push({ kind: "knowledge", ref: `${c.id}/${k.id}`, text: k.content ?? "" });
    }
  }
  for (const b of def.beats ?? []) {
    out.push({ kind: "beat", ref: b.id, text: b.narrationHints ?? "" });
  }
  for (const l of def.locations) {
    out.push({ kind: "location", ref: l.id, text: l.description ?? "", locationId: l.id });
  }
  return out;
}

export const MARK = { pass: "✔", warn: "◐", fail: "✘" };

export function printAudit(report, label) {
  console.log(`\n═══ ${report.audit.toUpperCase()} audit — ${label} ═══`);
  for (const c of report.checks ?? []) {
    console.log(`  ${MARK[c.verdict] ?? "?"} ${c.check}${c.note ? ` — ${c.note}` : ""}`);
  }
  const sevRank = { high: 0, medium: 1, info: 2 };
  const findings = [...(report.findings ?? [])].sort(
    (a, b) => (sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3)
  );
  if (findings.length) {
    console.log(`  Findings:`);
    for (const f of findings) console.log(`   [${f.severity}] ${f.text}`);
  }
  console.log(`  Grade: ${report.grade.toUpperCase()}`);
}

/** Roll checks+findings into a grade: any fail → fail, any warn/medium+ → warn. */
export function gradeOf(checks, findings) {
  if (checks.some((c) => c.verdict === "fail") || findings.some((f) => f.severity === "high"))
    return "fail";
  if (checks.some((c) => c.verdict === "warn") || findings.some((f) => f.severity === "medium"))
    return "warn";
  return "pass";
}
