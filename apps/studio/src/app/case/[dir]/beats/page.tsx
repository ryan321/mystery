import { loadCase } from "@/lib/content";
import { conditionToText, effectToText } from "@/lib/prose";

export const dynamic = "force-dynamic";

export default async function BeatsPage({
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

  const entrances = def.characters.filter((c) => c.entrance);

  return (
    <>
      <div className="section">
        <h3>
          Story beats — the living plot ({def.beats.length})
        </h3>
        {def.beats.map((b) => (
          <div className="beat" key={b.id}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <strong>{b.title ?? b.id}</strong>
              <span className="id">{b.id}</span>
              <span className="chip">{b.trigger ?? "on_turn"}</span>
              {b.once === false && <span className="chip warn">repeats</span>}
            </div>
            <div className="when">when {conditionToText(b.when)}</div>
            <ul>
              {b.effects.map((e, i) => (
                <li key={i}>{effectToText(e)}</li>
              ))}
            </ul>
            {b.narrationHints && <div className="hints">{b.narrationHints}</div>}
            {(b.reactions ?? []).map((r, i) => (
              <div className="hints" key={i}>
                {r.characterId}: “{r.lineHint ?? r.stance}”
              </div>
            ))}
          </div>
        ))}
      </div>

      {entrances.length > 0 && (
        <div className="section">
          <h3>Character entrances (synthetic beats)</h3>
          {entrances.map((c) => (
            <div className="beat" key={c.id}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <strong>{c.name}</strong>
                <span className="id">character_entrance_{c.id}</span>
                <span className="chip gold">
                  {c.entrance!.mode === "mention" ? "mention" : "appears"}
                </span>
              </div>
              <div className="when">
                when {conditionToText(c.entrance!.when)}
                {c.entrance!.atLocationId
                  ? ` → arrives at ${c.entrance!.atLocationId}`
                  : ""}
              </div>
              {c.entrance!.announce && (
                <div className="hints">{c.entrance!.announce}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="section">
        <h3>Wrap-up</h3>
        <div className="panel">
          <dl className="kv">
            <dt>Enabled</dt>
            <dd>{def.wrapUp?.enabled === false ? "no — hard cut" : "yes"}</dd>
            <dt>Max turns</dt>
            <dd>{def.wrapUp?.maxTurns ?? 10}</dd>
            <dt>Notes</dt>
            <dd>{def.wrapUp?.performanceNotes ?? "—"}</dd>
          </dl>
        </div>
      </div>
    </>
  );
}
