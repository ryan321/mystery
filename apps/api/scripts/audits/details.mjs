/**
 * Details audit — the pre-start marketing surface. Everything a player
 * can read BEFORE pressing Start ships from GET /v1/cases/:id — the whole
 * meta block, the player persona, and the cast cards — and renders on the
 * mystery detail page, the gallery, and the in-game briefing ("The
 * situation"). None of it may spend what the game sells: the copy must be
 * assembled from public-knowledge facts only, tease without answering,
 * and depict every character by their public face, never their private
 * state (docs/MYSTERY_PRINCIPLES.md §8e — discovery is the product).
 */
import { askJson, gradeOf, tokens } from "./shared.mjs";

/** The prose fields a player reads before starting. */
function surfaceProse(def) {
  const m = def.meta ?? {};
  return [
    { field: "premise", text: m.premise ?? "" },
    { field: "summary", text: m.summary ?? "" },
    { field: "theMystery", text: m.theMystery ?? "" },
    { field: "setting", text: m.setting ?? "" },
  ];
}

export async function runDetailsAudit(def, { llm = true } = {}) {
  const checks = [];
  const findings = [];
  const note = (severity, text) => findings.push({ severity, text });

  const prose = surfaceProse(def);
  const proseBlob = prose.map((p) => p.text).join(" ").toLowerCase();
  const cast = def.characters.filter((c) => c.knownAtStart !== false);
  const hidden = def.characters.filter((c) => c.knownAtStart === false);

  // 1. The marketing floor exists
  const missing = prose.filter((p) => !p.text.trim()).map((p) => p.field);
  checks.push({
    check: "surface_complete",
    verdict: missing.includes("premise") ? "fail" : missing.length ? "warn" : "pass",
    note: missing.length ? `missing: ${missing.join(", ")}` : "premise, summary, theMystery, setting all present",
  });

  // 2. Hidden cast (knownAtStart: false) never appears pre-start
  const cardBlob = cast.map((c) => `${c.name} ${c.cardTitle ?? ""}`).join(" ").toLowerCase();
  for (const h of hidden) {
    const hit = tokens(h.name).find((t) => proseBlob.includes(t) || cardBlob.includes(t));
    if (hit) note("high", `hidden character "${h.name}" surfaces pre-start (token "${hit}")`);
  }
  checks.push({
    check: "hidden_cast_hidden",
    verdict: findings.some((f) => f.text.startsWith("hidden character")) ? "fail" : "pass",
    note: `${hidden.length} hidden character(s) checked against pre-start prose and cast cards`,
  });

  // 3. The guilty party is never named in the copy (their neutral cast
  //    card is fine — they must be listed like everyone else).
  const guilty = (def.solution?.guiltyPartyIds ?? [])
    .map((id) => def.characters.find((c) => c.id === id))
    .filter(Boolean);
  const guiltyHits = guilty.flatMap((g) =>
    tokens(g.name).filter((t) => proseBlob.includes(t)).map((t) => `${g.name} ("${t}")`)
  );
  checks.push({
    check: "culprit_not_named",
    verdict: guiltyHits.length ? "fail" : "pass",
    note: guiltyHits.length ? `named in copy: ${guiltyHits.join(", ")}` : "no guilty-party name tokens in the copy",
  });

  // 4. Critical evidence stays undiscovered — its name tokens don't
  //    surface in the copy. One shared token is usually a public-fact
  //    collision ("settlement"), so it takes two distinct tokens from one
  //    evidence name to warn; the LLM pass below catches paraphrased leaks.
  const evidence = new Map((def.evidence ?? []).map((e) => [e.id, e]));
  const evMatches = (def.solution?.criticalEvidenceIds ?? [])
    .map((id) => evidence.get(id))
    .filter(Boolean)
    .map((e) => ({ name: e.name, hits: tokens(e.name).filter((t) => proseBlob.includes(t)) }))
    .filter((m) => m.hits.length > 0);
  const evStrong = evMatches.filter((m) => m.hits.length >= 2);
  checks.push({
    check: "critical_evidence_unspoiled",
    verdict: evStrong.length ? "warn" : "pass",
    note: evMatches.length
      ? evMatches.map((m) => `${m.name} ("${m.hits.join('", "')}")`).join(", ")
      : "no critical-evidence name tokens in the copy",
  });
  for (const m of evMatches) {
    note(m.hits.length >= 2 ? "medium" : "info", `copy touches critical evidence: ${m.name} ("${m.hits.join('", "')}")`);
  }

  // 5. Cast cards stay title-sized — a long cardTitle is a bio leaking out
  for (const c of cast) {
    const words = (c.cardTitle ?? "").split(/\s+/).filter(Boolean).length;
    if (words > 8) note("medium", `cardTitle for ${c.name} runs ${words} words — bio creep on a public card`);
  }
  checks.push({
    check: "card_titles_short",
    verdict: findings.some((f) => f.text.includes("bio creep")) ? "warn" : "pass",
    note: `${cast.length} cast cards checked (title-sized = ≤8 words)`,
  });

  // 6. Semantic leak check (LLM) — paraphrase is how spoilers actually
  //    escape ("someone who never walks" names no one and fingers one).
  let report = null;
  if (llm) {
    const gated = def.characters.map((c) => ({
      id: c.id,
      public: (c.knowledge?.public ?? "").slice(0, 400),
      gated: [...(c.knowledge?.private ?? []), ...(c.knowledge?.secrets ?? [])].map((k) => ({
        id: k.id,
        content: (k.content ?? "").slice(0, 250),
      })),
    }));
    const criticalEvidence = (def.solution?.criticalEvidenceIds ?? [])
      .map((id) => evidence.get(id))
      .filter(Boolean)
      .map((e) => ({ name: e.name, description: (e.description ?? "").slice(0, 250) }));

    report = await askJson(`You audit the PRE-START SURFACE of an interactive mystery — the copy a
player reads before the first turn. The philosophy: every fact handed over up front is a fact
the player can no longer DISCOVER, and discovery is the product. The copy may tease with
public facts and open questions; it must never spend a gated discovery, state or imply the
method, point at the culprit, or describe a character's private state as if it were their
public face.

PRE-START SURFACE (everything shown before Start):
${JSON.stringify({
  meta: def.meta,
  player: {
    displayName: def.player?.displayName,
    role: def.player?.role,
    appearance: def.player?.appearance,
    objective: def.player?.objective,
  },
  castCards: cast.map((c) => ({ name: c.name, cardTitle: c.cardTitle ?? "", storyRole: c.storyRole ?? "suspect" })),
})}

SEALED SOLUTION (for leak-checking only — the player must never infer this from the copy):
${JSON.stringify({ summary: def.solution?.summary, method: def.solution?.method, motive: def.solution?.motive })}

GATED DISCOVERIES (public = safe to echo; gated = must NOT be echoed or implied):
${JSON.stringify(gated)}

CRITICAL EVIDENCE (in-game discoveries the copy must not pre-announce):
${JSON.stringify(criticalEvidence)}

Grade each check pass | strain | fail with a one-sentence note (and a fix when not pass):

- method_concealed: no phrase in the copy states or implies the method or the central trick,
  even obliquely or by paraphrase.
- culprit_concealed: no phrase singles out, uniquely describes, or gestures at the guilty
  party — including riddle-shaped descriptions that name no one but fit only one person.
- discoveries_ungifted: every factual claim in the copy is checkable against some character's
  PUBLIC knowledge; nothing echoes gated knowledge or pre-announces critical evidence.
- public_face_only: each character depicted in the copy is depicted by their public
  presentation; no leaked inner state, hidden motive, or private grievance.
- hooks_ask_dont_answer: hooks may raise anomalies and questions; none of them resolves the
  anomaly it raises.

Reply JSON:
{
 "checks": [{"id": "method_concealed", "verdict": "pass|strain|fail", "note": "...", "fix": "..."}],
 "leaks": [{"quote": "the leaking phrase, verbatim", "field": "premise|summary|theMystery|setting|castCards|player",
            "spoils": "what the player can now skip discovering", "severity": "high|medium|info"}],
 "overall": "sound|strained|broken"
}`);
    // Models sometimes emit ["method_concealed", {verdict...}] instead of
    // [{id: "method_concealed", verdict...}] — carry bare-string ids forward.
    let carryId = null;
    for (const c of report.checks ?? []) {
      if (typeof c === "string") {
        carryId = c;
        continue;
      }
      if (typeof c !== "object" || c === null) continue;
      checks.push({
        check: `details:${c.id ?? carryId ?? "?"}`,
        verdict: c.verdict === "pass" ? "pass" : c.verdict === "strain" ? "warn" : "fail",
        note: (c.note ?? "") + (c.fix && c.verdict !== "pass" ? ` (fix: ${c.fix})` : ""),
      });
      carryId = null;
    }
    for (const l of report.leaks ?? []) {
      note(l.severity ?? "medium", `[${l.field}] "${l.quote}" — spoils: ${l.spoils}`);
    }
  }

  return { audit: "details", grade: gradeOf(checks, findings), checks, findings, report };
}
