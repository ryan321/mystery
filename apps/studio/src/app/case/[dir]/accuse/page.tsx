import { loadCase } from "@/lib/content";
import { resolveAccuseStaging } from "@mystery/engine";
import type { Ending } from "@mystery/shared";

export const dynamic = "force-dynamic";

/**
 * Accuse — the whole accusation flow for this case, end to end:
 *   1. how the player opens it (Accuse button ceremony vs. free text),
 *   2. WHAT GETS SET UP when they do (where the charge is heard, who is
 *      gathered, the confirm line, placeholder, win hint, staging cue),
 *   3. how the charge is judged (guilty party, success policy, rubric facts),
 *   4. HOW IT ENDS — endings grouped by the accusation outcome that reaches
 *      them, plus the endings reached by other means.
 *
 * Staging is resolved through the engine's own resolveAccuseStaging, so this
 * mirrors exactly what a player will see and what the engine will stage.
 */

const POLICY_GLOSS: Record<string, string> = {
  identity: "Naming the culprit alone closes the case.",
  identity_plus_one:
    "The culprit plus at least one supporting fact (method, motive, or a detail). Default.",
  all_facts: "Every required fact must be matched. Strict.",
};

const WHEN_LABEL: Record<Ending["when"], string> = {
  success: "success",
  partial: "partial",
  failure: "failure",
  custom: "custom",
};

function EndingCard({ e }: { e: Ending }) {
  const whenClass =
    e.when === "success" ? "ok" : e.when === "failure" ? "warn" : "gold";
  return (
    <div className="panel" style={{ marginTop: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontFamily: "var(--serif)", fontSize: 16 }}>
          {e.title ?? e.id}
        </strong>
        <span className="idref">{e.id}</span>
        <span className={`chip ${whenClass}`}>{WHEN_LABEL[e.when]}</span>
        {e.kind ? <span className="chip">{e.kind}</span> : null}
        {e.requiresFlags && Object.keys(e.requiresFlags).length > 0 ? (
          <span className="chip" title="Only chosen when these flags match">
            needs flags:{" "}
            {Object.entries(e.requiresFlags)
              .map(([k, v]) => `${k}=${String(v)}`)
              .join(", ")}
          </span>
        ) : null}
      </div>
      <p
        style={{
          marginTop: 8,
          fontFamily: "var(--serif)",
          fontSize: 14,
          color: "#c9ceda",
          lineHeight: 1.6,
        }}
      >
        {e.templateNotes}
      </p>
    </div>
  );
}

function EndingGroup({
  title,
  hint,
  endings,
  empty,
}: {
  title: string;
  hint: string;
  endings: Ending[];
  empty?: string;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
        {title}{" "}
        <span style={{ color: "var(--dim)", fontWeight: 400 }}>
          — {hint}
        </span>
      </div>
      {endings.length === 0 ? (
        <p className="explain" style={{ marginTop: 6 }}>
          {empty ?? "None authored."}
        </p>
      ) : (
        endings.map((e) => <EndingCard key={e.id} e={e} />)
      )}
    </div>
  );
}

export default async function AccusePage({
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

  const locName = (id: string) =>
    def.locations.find((l) => l.id === id)?.name ?? id;
  const charName = (id: string) =>
    def.characters.find((c) => c.id === id)?.name ?? id;

  // --- Resolved staging (engine's own resolver → what the player really gets)
  const staging = resolveAccuseStaging(def);
  const authoredStaging = def.accusePolicy?.staging;
  const requireConfirmation = def.accusePolicy?.requireConfirmation ?? true;
  const pendingTurns = def.accusePolicy?.pendingTurns ?? 3;

  const stagingLoc = staging.locationId ? locName(staging.locationId) : null;

  const nonVictim = def.characters.filter((c) => c.storyRole !== "victim");
  const gatherAll =
    !staging.gatherCharacterIds || staging.gatherCharacterIds.length === 0;
  const gatherIds = gatherAll
    ? nonVictim.map((c) => c.id)
    : staging.gatherCharacterIds!;
  const gatherNames = gatherIds.map(charName);

  const confirmAuthored = Boolean(authoredStaging?.confirmPrompt?.trim());

  // --- Judging rubric
  const guilty = def.solution.guiltyPartyIds;
  const successPolicy = def.solution.rubric.successPolicy;
  const facts = def.solution.rubric.requiredFacts;
  const partialCredit = def.solution.rubric.partialCredit !== false;
  const criticalCount = def.solution.criticalEvidenceIds.length;

  // --- Endings grouped by which accusation outcome reaches them
  const endings = def.endings;
  const successEndings = endings.filter((e) => e.when === "success");
  const partialEndings = endings.filter((e) => e.when === "partial");
  const wrongEndings = endings.filter(
    (e) => e.when === "failure" && e.kind === "wrong_accusation"
  );
  const otherEndings = endings.filter(
    (e) =>
      (e.when === "failure" && e.kind !== "wrong_accusation") ||
      e.when === "custom"
  );

  return (
    <>
      <div className="section" style={{ marginBottom: 8 }}>
        <h3>Accuse — the accusation flow</h3>
        <p className="subtitle" style={{ marginTop: 2 }}>
          What happens when the player brings a formal charge — what gets set
          up, and how the case ends.
        </p>
      </div>

      {/* --- 1. The two ways to accuse --------------------------------- */}
      <div className="section">
        <h3>How the player opens it</h3>
        <div className="panel">
          <p style={{ fontSize: 14 }}>
            <strong style={{ color: "var(--accent)" }}>Accuse button</strong> —
            the red button in the play toolbar. It asks the player to confirm
            (the dialog copy below), then the engine{" "}
            <em>stages the ceremony</em>: it{" "}
            {stagingLoc ? (
              <>
                moves the player and the gathered cast to the{" "}
                <strong>{stagingLoc}</strong>
              </>
            ) : (
              <>gathers the cast wherever the player is standing</>
            )}{" "}
            and waits. The player&rsquo;s next free-text line <em>is</em> the
            charge.
          </p>
          <p style={{ fontSize: 14, marginTop: 10 }}>
            <strong style={{ color: "var(--accent)" }}>Free text</strong> —
            saying it in the open (&ldquo;I accuse&hellip;&rdquo;) at any time.{" "}
            {requireConfirmation ? (
              <>
                An informal theory goes <em>pending</em> and must be confirmed
                within <strong>{pendingTurns}</strong> turn
                {pendingTurns === 1 ? "" : "s"}; explicitly formal wording is
                judged at once.
              </>
            ) : (
              <>Any accusation is judged immediately — no confirmation step.</>
            )}
          </p>
        </div>
      </div>

      {/* --- 2. What gets set up (staging) ----------------------------- */}
      <div className="section">
        <h3>What gets set up</h3>
        <div className="panel">
          <dl className="kv">
            <dt>Heard in</dt>
            <dd>
              {stagingLoc ? (
                <>
                  {stagingLoc}{" "}
                  <span className="idref">{staging.locationId}</span>
                  <span style={{ color: "var(--dim)" }}>
                    {" "}
                    · player &amp; cast are moved here
                  </span>
                </>
              ) : (
                <span style={{ color: "var(--dim)" }}>
                  Wherever the player is standing (no staging location set)
                </span>
              )}
            </dd>

            <dt>Who gathers</dt>
            <dd>
              {gatherAll ? (
                <span style={{ color: "var(--dim)" }}>
                  Everyone available — all {gatherNames.length} non-victim
                  characters (no explicit list; engine default):{" "}
                </span>
              ) : null}
              <span
                style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}
              >
                {gatherNames.map((n, i) => (
                  <span key={i} className="chip">
                    {n}
                  </span>
                ))}
              </span>
            </dd>

            <dt>Confirm dialog</dt>
            <dd>
              <span
                className={`chip ${confirmAuthored ? "gold" : ""}`}
                style={{ marginRight: 8 }}
              >
                {confirmAuthored ? "authored" : "default"}
              </span>
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 14.5,
                  color: "#d6dae2",
                }}
              >
                &ldquo;{staging.confirmPrompt}&rdquo;
              </span>
            </dd>

            <dt>Composer prompt</dt>
            <dd style={{ color: "#c9ceda" }}>{staging.composerPlaceholder}</dd>

            <dt>Win hint</dt>
            <dd style={{ color: "#c9ceda" }}>{staging.winHint}</dd>
          </dl>

          <div style={{ marginTop: 14 }}>
            <div className="explain" style={{ marginBottom: 4 }}>
              Staging cue to the performer (author-facing — never shown to the
              player):
            </div>
            <p
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 13.5,
                color: "var(--dim)",
                lineHeight: 1.6,
                borderLeft: "2px solid var(--line)",
                paddingLeft: 12,
              }}
            >
              {staging.narrationHints}
            </p>
          </div>
        </div>
      </div>

      {/* --- 3. How the charge is judged ------------------------------- */}
      <div className="section">
        <h3>How the charge is judged</h3>
        <div className="panel">
          <dl className="kv">
            <dt>Guilty party</dt>
            <dd>
              {guilty.length ? (
                guilty.map((id) => (
                  <span key={id} className="chip warn" style={{ marginRight: 6 }}>
                    {charName(id)}
                  </span>
                ))
              ) : (
                <span style={{ color: "var(--red)" }}>none set!</span>
              )}
            </dd>
            <dt>Success policy</dt>
            <dd>
              <code style={{ color: "var(--accent)" }}>{successPolicy}</code>
              <span style={{ color: "var(--dim)" }}>
                {" "}
                — {POLICY_GLOSS[successPolicy] ?? ""}
              </span>
            </dd>
            <dt>Partial credit</dt>
            <dd style={{ color: "var(--dim)" }}>
              {partialCredit
                ? "On — a partly-right charge can reach a partial ending."
                : "Off — it is a full solve or a failure, nothing between."}
            </dd>
            <dt>Evidence</dt>
            <dd style={{ color: "var(--dim)" }}>
              Never required to win. {criticalCount} critical clue
              {criticalCount === 1 ? "" : "s"} mark a correct charge as{" "}
              <em>earned</em> rather than a <em>lucky</em> cold guess.
            </dd>
          </dl>

          <div style={{ marginTop: 14 }}>
            <div className="explain" style={{ marginBottom: 6 }}>
              Required facts the charge is scored against:
            </div>
            <table className="plain">
              <thead>
                <tr>
                  <th>Fact</th>
                  <th>Role</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {facts.map((f) => (
                  <tr key={f.id}>
                    <td
                      style={{
                        fontFamily: "var(--mono)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.id}
                    </td>
                    <td>{f.role ?? "supporting"}</td>
                    <td style={{ color: "#c9ceda" }}>{f.description}</td>
                  </tr>
                ))}
                {facts.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ color: "var(--dim)" }}>
                      No rubric facts — identity alone decides the outcome.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- 4. How it ends -------------------------------------------- */}
      <div className="section">
        <h3>How it ends</h3>
        <EndingGroup
          title="✓ Correct accusation"
          hint="a solve. kind lucky_solve = correct but cold (no evidence); solved = earned"
          endings={successEndings}
          empty="No success ending — the case cannot be won!"
        />
        {partialCredit || partialEndings.length > 0 ? (
          <EndingGroup
            title="~ Partly right"
            hint="right person, thin on how/why — a bittersweet close"
            endings={partialEndings}
            empty="No partial ending authored — a partly-right charge falls back to a success ending."
          />
        ) : null}
        <EndingGroup
          title="✗ Wrong accusation"
          hint="named the wrong person or an unsupportable theory"
          endings={wrongEndings}
          empty="No wrong_accusation ending — a false charge falls back to the first failure ending."
        />
        <EndingGroup
          title="Reached other ways"
          hint="not from the charge itself — ran out of time, killed, arrested, culprit escaped"
          endings={otherEndings}
          empty="None."
        />
      </div>
    </>
  );
}
