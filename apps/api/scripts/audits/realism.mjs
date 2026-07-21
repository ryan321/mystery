/**
 * Realism audit — is everything plausible GIVEN the setting? Anachronisms,
 * social conventions, procedure, money, language, objects. The setting is
 * whatever the definition declares; the audit holds the story to it.
 */
import { askJson, gradeOf } from "./shared.mjs";

export async function runRealismAudit(def, { llm = true } = {}) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });

  // The setting line is the visitor's when-and-where (schema contract:
  // "A fogbound pier, low tide, 1924."). A case that never says its era
  // leaves the shelf visitor guessing 1880s London vs 1930s New Jersey.
  const settingLine = def.meta?.setting ?? "";
  const declaresWhen =
    /\b(1[0-9]{3}|20[0-9]{2})s?\b|victorian|edwardian|georgian|regency|medieval|renaissance|colonial|antebellum|interwar|midcentury|present.day|modern.day/i.test(
      settingLine
    );
  checks.push({
    check: "setting_declares_when_where",
    verdict: declaresWhen ? "pass" : "warn",
    note: declaresWhen
      ? `"${settingLine.slice(0, 80)}"`
      : `meta.setting never says WHEN: "${settingLine.slice(0, 80)}" — a visitor cannot place the era`,
  });

  if (llm) {
    const corpus = {
      meta: { setting: def.meta?.setting, theme: def.meta?.theme, tone: def.meta?.tone, premise: def.meta?.premise },
      locations: def.locations.map((l) => ({ id: l.id, name: l.name, description: l.description,
        inspectables: (l.inspectables ?? []).map((i) => ({ id: i.id, name: i.name, hints: i.onInspect?.narrativeHints })) })),
      evidence: def.evidence.map((e) => ({ id: e.id, name: e.name, description: e.description })),
      characters: def.characters.map((c) => ({ id: c.id, role: c.storyRole, bio: c.shortBio,
        public: c.knowledge?.public,
        items: [...(c.knowledge?.private ?? []), ...(c.knowledge?.secrets ?? [])].map((k) => k.content) })),
      canon: def.canon?.timeline ?? [],
      figures: def.figures ?? [],
    };
    const report = await askJson(`You are a period/setting continuity expert auditing a mystery for REALISM
GIVEN ITS OWN SETTING. First infer the period and place from the material. Then hunt for breaks:

- technology & objects that don't belong (or that the period demands and the story lacks)
- social conventions: class, service, gender, family, propriety
- procedure: law, police, inquests, medicine, death customs
- money: wages, fortunes, settlements — are magnitudes sane?
- language: dialogue idioms that break the period voice
- material world: buildings, travel, weather behavior, lighting

MATERIAL:
${JSON.stringify(corpus, null, 1)}

Severity: "breaking" = snaps immersion for a lay reader; "moderate" = a genre-literate reader
notices; "minor" = a historian notices. Cite the id of the offending item. Do NOT invent
problems to fill quota — an empty findings list is a valid answer.

Reply JSON:
{
 "period_inferred": "...",
 "findings": [{"area": "technology|social|procedural|economic|language|material", "severity": "breaking|moderate|minor", "where": "id", "item": "...", "why": "...", "fix": "..."}],
 "strengths": ["...what the story gets convincingly right..."],
 "overall": "convincing|uneven|broken"
}`);
    for (const f of report.findings ?? [])
      note(f.severity === "breaking" ? "high" : f.severity === "moderate" ? "medium" : "info",
        `[${f.area}] ${f.where}: ${f.item} — ${f.why}${f.fix ? ` (fix: ${f.fix})` : ""}`);
    checks.push({
      check: "period_inferred",
      verdict: "pass",
      note: report.period_inferred ?? "?",
    });
    checks.push({
      check: "realism_overall",
      verdict: report.overall === "convincing" ? "pass" : report.overall === "uneven" ? "warn" : "fail",
      note: (report.strengths ?? []).slice(0, 2).join("; "),
    });
    return { audit: "realism", grade: gradeOf(checks, findings), checks, findings, report };
  }

  checks.push({ check: "realism_overall", verdict: "warn", note: "LLM disabled — realism needs a reader" });
  return { audit: "realism", grade: "warn", checks, findings };
}
