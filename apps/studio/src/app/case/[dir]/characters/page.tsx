import { loadCase, assetUrl } from "@/lib/content";
import { conditionToText } from "@/lib/prose";
import { Zoomable } from "@/app/zoomable";
import type { KnowledgeBeat } from "@mystery/shared";

export const dynamic = "force-dynamic";

function gates(k: KnowledgeBeat): string {
  const parts: string[] = [];
  if (k.requiresEvidenceIds?.length) {
    parts.push(`needs ${k.requiresEvidenceIds.join(", ")}`);
  }
  if (k.requiresFlags) {
    parts.push(
      Object.entries(k.requiresFlags)
        .map(([f, v]) => `flag ${f}=${v}`)
        .join(", ")
    );
  }
  if (k.requiresTrust != null) parts.push(`trust ≥ ${k.requiresTrust}`);
  if (k.requiresWillingnessIn?.length) {
    parts.push(`willingness: ${k.requiresWillingnessIn.join("/")}`);
  }
  if (k.requiresRelationshipIds?.length || k.requiresRelationshipId) {
    parts.push("bond known");
  }
  return parts.length ? `⟨ ${parts.join(" · ")} ⟩` : "⟨ freely shared once willing ⟩";
}

export default async function CharactersPage({
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
    <div className="people">
      {def.characters.map((c) => (
        <div className="person" key={c.id}>
          <div className="head">
            {c.portrait ? (
              <Zoomable
                className="portrait"
                src={assetUrl(dir, c.portrait)}
                alt={c.name}
                caption={`${c.name} · ${c.portrait}`}
              />
            ) : (
              <div className="portrait blank">?</div>
            )}
            <div>
              <h4>{c.name}</h4>
              <div className="role">
                {c.storyRole ?? "suspect"}
                {def.solution.guiltyPartyIds.includes(c.id) && (
                  <span className="chip warn" style={{ marginLeft: 8 }}>
                    guilty
                  </span>
                )}
                {c.knownAtStart === false && (
                  <span className="chip gold" style={{ marginLeft: 8 }}>
                    hidden until entrance
                  </span>
                )}
                {c.nameKnownAtStart === false && (
                  <span className="chip" style={{ marginLeft: 8 }}>
                    known as “{c.introducedAs ?? "?"}”
                  </span>
                )}
              </div>
              <div className="bio">{c.shortBio ?? ""}</div>
              {c.voice && (
                <div className="bio" style={{ color: "var(--dim)", marginTop: 4 }}>
                  Voice: {c.voice}
                </div>
              )}
            </div>
          </div>

          {c.entrance && (
            <div className="kn">
              <span className="lvl private">entrance</span>
              <span className="txt">
                {c.entrance.mode === "mention" ? "mentioned" : "appears"} when{" "}
                {conditionToText(c.entrance.when)}
                {c.entrance.atLocationId ? ` at ${c.entrance.atLocationId}` : ""}
              </span>
            </div>
          )}

          <div className="kn">
            {c.knowledge.public && (
              <div className="k">
                <span className="lvl public">public</span>
                <span className="txt">{c.knowledge.public}</span>
              </div>
            )}
            {c.knowledge.private.map((k) => (
              <div className="k" key={k.id}>
                <span className="lvl private">private</span>
                <span className="txt">{k.content}</span>{" "}
                <span className="gate">{gates(k)}</span>
              </div>
            ))}
            {c.knowledge.secrets.map((k) => (
              <div className="k" key={k.id}>
                <span className="lvl secret">secret</span>
                <span className="txt">{k.content}</span>{" "}
                <span className="gate">{gates(k)}</span>
              </div>
            ))}
            {c.defenses.length > 0 && (
              <div className="k">
                <span className="lvl secret">defends</span>
                <span className="txt" style={{ color: "var(--dim)" }}>
                  {c.defenses.join(" · ")}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
