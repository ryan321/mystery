import { loadCase, assetUrl } from "@/lib/content";
import { conditionToText } from "@/lib/prose";

export const dynamic = "force-dynamic";

export default async function WorldPage({
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

  // Sketch map from authored grid coords
  const mapped = def.locations.filter((l) => l.map);
  const CELL = 170;
  const PAD = 40;
  const xs = mapped.map((l) => l.map!.x);
  const ys = mapped.map((l) => l.map!.y);
  const minX = Math.min(...xs, 0);
  const minY = Math.min(...ys, 0);
  const W = (Math.max(...xs, 0) - minX + 1) * CELL + PAD * 2;
  const H = (Math.max(...ys, 0) - minY + 1) * CELL + PAD * 2;
  const px = (x: number) => PAD + (x - minX) * CELL + CELL / 2;
  const py = (y: number) => PAD + (y - minY) * CELL + CELL / 2;

  return (
    <>
      {mapped.length > 0 && (
        <div className="section">
          <h3>Sketch map</h3>
          <div className="panel" style={{ overflowX: "auto" }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }}>
              {def.locations.flatMap((l) =>
                (l.exits ?? []).map((e) => {
                  const to = def.locations.find(
                    (x) => x.id === e.toLocationId
                  );
                  if (!l.map || !to?.map) return null;
                  return (
                    <line
                      key={`${l.id}->${e.toLocationId}`}
                      x1={px(l.map.x)}
                      y1={py(l.map.y)}
                      x2={px(to.map.x)}
                      y2={py(to.map.y)}
                      stroke={e.startsClosed ? "#59607080" : "#8b93a3"}
                      strokeWidth={1.5}
                      strokeDasharray={
                        e.startsClosed || e.requiresEvidenceIds?.length
                          ? "5 4"
                          : undefined
                      }
                    />
                  );
                })
              )}
              {mapped.map((l) => (
                <g key={l.id}>
                  <rect
                    x={px(l.map!.x) - 62}
                    y={py(l.map!.y) - 30}
                    width={124}
                    height={60}
                    rx={7}
                    fill="#1b1f27"
                    stroke={
                      l.id === def.player.startingLocationId
                        ? "#d9a441"
                        : "#3a4150"
                    }
                    strokeWidth={1.8}
                    strokeDasharray={l.knownAtStart === false ? undefined : undefined}
                  />
                  <text
                    x={px(l.map!.x)}
                    y={py(l.map!.y) - 2}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#e3e6ec"
                  >
                    {l.name.replace(/^.*—\s*/, "").slice(0, 20)}
                  </text>
                  <text
                    x={px(l.map!.x)}
                    y={py(l.map!.y) + 15}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="#8b93a3"
                  >
                    {[
                      l.map!.floor != null ? `floor ${l.map!.floor}` : null,
                      l.knownAtStart ? "known at start" : null,
                      l.id === def.player.startingLocationId ? "start" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}

      <div className="section">
        <h3>Locations</h3>
        {def.locations.map((l) => (
          <div className="beat" key={l.id}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <strong>{l.name}</strong>
              <span className="id">{l.id}</span>
              {l.knownAtStart && <span className="chip">on map at start</span>}
              {!l.startsAccessible && (
                <span className="chip warn">starts sealed</span>
              )}
              {(l.hazards ?? []).length > 0 && (
                <span className="chip warn">
                  {l.hazards!.length} hazard{l.hazards!.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="hints" style={{ marginTop: 6 }}>
              {l.description}
            </div>
            <ul>
              {l.exits.map((e) => (
                <li key={e.toLocationId}>
                  exit → {e.toLocationId}
                  {e.startsClosed ? " (starts closed)" : ""}
                  {e.requiresEvidenceIds?.length
                    ? ` (needs ${e.requiresEvidenceIds.join(", ")})`
                    : ""}
                </li>
              ))}
              {l.inspectables.map((i) => (
                <li key={i.id}>
                  inspect <strong>{i.name}</strong>
                  {i.onInspect.revealsEvidenceIds?.length
                    ? ` → yields ${i.onInspect.revealsEvidenceIds.join(", ")}`
                    : ""}
                  {i.onInspect.requiresEvidenceIds?.length
                    ? ` (needs ${i.onInspect.requiresEvidenceIds.join(", ")})`
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="section">
        <h3>Evidence</h3>
        <table className="plain">
          <thead>
            <tr>
              <th>Item</th>
              <th>Found</th>
              <th>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {def.evidence.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.name}</strong>
                  <div className="id" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)" }}>
                    {e.id}
                  </div>
                </td>
                <td>
                  {e.discoverableAt
                    ? `${e.discoverableAt.locationId} · ${e.discoverableAt.inspectableId}`
                    : "granted by beats"}
                </td>
                <td style={{ color: "var(--dim)" }}>{e.description}</td>
                <td>
                  {def.solution.criticalEvidenceIds.includes(e.id) && (
                    <span className="chip gold">critical</span>
                  )}
                  {e.redHerring && <span className="chip">red herring</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {def.time && (
        <div className="section">
          <h3>Clock</h3>
          <div className="panel">
            <dl className="kv">
              <dt>Starts</dt>
              <dd>{def.time.startSlotId}</dd>
              <dt>Per turn</dt>
              <dd>{def.time.minutesPerTurn} min</dd>
              <dt>Schedule</dt>
              <dd>
                {def.time.schedule
                  .map((sl) => `${sl.label ?? sl.id} (${sl.minutesFromStart}m)`)
                  .join(" → ")}
              </dd>
            </dl>
          </div>
        </div>
      )}

      {def.locations.some((l) => l.image) && (
        <div className="section">
          <h3>Location art</h3>
          <div className="grid">
            {def.locations
              .filter((l) => l.image)
              .map((l) => (
                <div className="card" key={l.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="cover" src={assetUrl(dir, l.image)} alt="" />
                  <div className="body">
                    <h2 style={{ fontSize: 15 }}>{l.name}</h2>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {(def.locations.flatMap((l) => l.hazards ?? []).length > 0) && (
        <div className="section">
          <h3>Hazards</h3>
          {def.locations.flatMap((l) =>
            (l.hazards ?? []).map((h) => (
              <div className="beat" key={`${l.id}-${h.id}`}>
                <strong>{h.id}</strong> <span className="id">in {l.id}</span>
                <div className="hints">{h.description}</div>
                <ul>
                  <li>
                    trigger {h.trigger} · severity {h.severity}
                    {h.fallToLocationId ? ` · falls to ${h.fallToLocationId}` : ""}
                  </li>
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      {def.accusePolicy && (
        <div className="section">
          <h3>Accuse policy</h3>
          <div className="panel">
            {conditionToText({ type: "always" }) && (
              <dl className="kv">
                <dt>Confirmation</dt>
                <dd>
                  {def.accusePolicy.requireConfirmation
                    ? `required (pending ${def.accusePolicy.pendingTurns} turns)`
                    : "judged on first utterance"}
                </dd>
              </dl>
            )}
          </div>
        </div>
      )}
    </>
  );
}
