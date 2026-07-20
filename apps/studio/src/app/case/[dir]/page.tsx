import { loadCase } from "@/lib/content";
import type { AccusationSuccessPolicy } from "@mystery/shared";

export const dynamic = "force-dynamic";

/** Plain-language meaning of solution.rubric.successPolicy. */
const POLICY_TEXT: Record<AccusationSuccessPolicy, string> = {
  identity: "Naming the culprit alone closes the case.",
  identity_plus_one:
    "The accusation must name the culprit plus at least one more facet of the truth — method, motive, or a supporting fact.",
  all_facts:
    "The accusation must match every truth facet listed below. Strict.",
};

/** The Story tab: read the mystery like a writer's outline. */
export default async function StoryPage({
  params,
}: {
  params: Promise<{ dir: string }>;
}) {
  const { dir } = await params;
  const loaded = loadCase(dir);
  if (!loaded?.valid) {
    return <p className="status-err">Fix schema errors in Edit JSON first.</p>;
  }
  const def = loaded.def;

  return (
    <>
      <div className="section">
        <h3>Premise</h3>
        <div className="prose">
          <p>{def.meta.premise}</p>
        </div>
      </div>

      <div className="section">
        <h3>You are</h3>
        <div className="prose">
          <p>
            <strong>{def.player.displayName}</strong> — {def.player.role}.{" "}
            {def.player.objective ?? ""}
          </p>
        </div>
      </div>

      {def.player.briefing && (
        <div className="section">
          <h3>Opening package ({def.player.briefing.form})</h3>
          <div className="prose">
            {def.player.briefing.sections.map((s, i) => (
              <div key={i}>
                <div className="h">{s.heading}</div>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <h3>Opening narration</h3>
        <div className="prose">
          <p>{def.openingNarration}</p>
        </div>
      </div>

      <div className="section">
        <h3>The sealed truth</h3>
        <div className="panel">
          <dl className="kv">
            <dt>Guilty</dt>
            <dd>
              {def.solution.guiltyPartyIds.length === 0 && "—"}
              {def.solution.guiltyPartyIds.map((id, i) => {
                const c = def.characters.find((ch) => ch.id === id);
                return (
                  <span key={id}>
                    {i > 0 && ", "}
                    {c ? (
                      <>
                        <strong>{c.name}</strong>{" "}
                        <span className="idref">({id})</span>
                      </>
                    ) : (
                      <span className="status-err">
                        {id} — no character with this id
                      </span>
                    )}
                  </span>
                );
              })}
            </dd>
            <dt>Method</dt>
            <dd>{def.solution.method ?? "—"}</dd>
            <dt>Motive</dt>
            <dd>{def.solution.motive ?? "—"}</dd>
            <dt>Summary</dt>
            <dd>{def.solution.summary}</dd>
            {def.solution.criticalEvidenceIds.length > 0 && (
              <>
                <dt>Critical evidence</dt>
                <dd>
                  {def.solution.criticalEvidenceIds.map((id, i) => {
                    const e = def.evidence.find((ev) => ev.id === id);
                    return (
                      <span key={id}>
                        {i > 0 && ", "}
                        {e ? (
                          <>
                            {e.name} <span className="idref">({id})</span>
                          </>
                        ) : (
                          <span className="status-err">
                            {id} — no evidence with this id
                          </span>
                        )}
                      </span>
                    );
                  })}
                  <div className="explain">
                    Holding these marks the solve as earned — never required
                    for a successful accusation.
                  </div>
                </dd>
              </>
            )}
            <dt>To win</dt>
            <dd>
              <span className="chip gold">
                {def.solution.rubric.successPolicy}
              </span>
              <div className="explain">
                {POLICY_TEXT[def.solution.rubric.successPolicy]}
                {def.solution.rubric.partialCredit &&
                  " Partial credit is scored for naming some of it."}
              </div>
            </dd>
            {def.solution.rubric.requiredFacts.length > 0 && (
              <>
                <dt>Truth facets</dt>
                <dd>
                  {def.solution.rubric.requiredFacts.map((f) => (
                    <div key={f.id} style={{ marginBottom: 8 }}>
                      <span className="chip">{f.role ?? "supporting"}</span>{" "}
                      {f.description}
                      {f.matchHints.length > 0 && (
                        <div className="idref" style={{ marginTop: 2 }}>
                          matches: {f.matchHints.join(" · ")}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="explain">
                    The engine scores the player&apos;s free-text accusation
                    against these facets by matching names and hints.
                  </div>
                </dd>
              </>
            )}
          </dl>
        </div>
        {def.canon && def.canon.timeline.length > 0 && (
          <div className="panel">
            <div
              className="h"
              style={{
                color: "var(--dim)",
                fontSize: 12,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Canon timeline (never shown to the AI)
            </div>
            <div className="timeline">
              {def.canon.timeline.map((t, i) => (
                <div key={i}>
                  <span className="at">{t.at}</span>
                  <div>{t.event}</div>
                  {(t.actorIds.length > 0 || t.locationId) && (
                    <div style={{ color: "var(--dim)", fontSize: 12.5 }}>
                      {[t.actorIds.join(", "), t.locationId]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="section">
        <h3>Endings</h3>
        {def.endings.map((e) => (
          <div className="beat" key={e.id}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <strong>{e.title ?? e.id}</strong>
              <span className={`chip ${e.when === "success" ? "ok" : e.when === "failure" ? "warn" : ""}`}>
                {e.when}
                {e.kind ? ` · ${e.kind}` : ""}
              </span>
            </div>
            <div className="hints">{e.templateNotes}</div>
          </div>
        ))}
      </div>

      {def.phases.length > 0 && (
        <div className="section">
          <h3>Phases</h3>
          <div className="panel">
            <dl className="kv">
              {def.phases.map((p) => (
                <PhaseRow key={p.id} id={p.id} description={p.description} />
              ))}
            </dl>
          </div>
        </div>
      )}
    </>
  );
}

function PhaseRow({ id, description }: { id: string; description?: string }) {
  return (
    <>
      <dt>{id}</dt>
      <dd>{description ?? ""}</dd>
    </>
  );
}
