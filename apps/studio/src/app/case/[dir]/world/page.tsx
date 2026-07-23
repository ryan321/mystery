import { loadCase, assetUrl } from "@/lib/content";
import { conditionToText } from "@/lib/prose";
import WorldMap, { type WorldRoom } from "./WorldMap";

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

  // Floor plan — normalize the authored def into what the map draws.
  const startId = def.player.startingLocationId;
  const worldRooms: WorldRoom[] = def.locations.map((l) => ({
    id: l.id,
    name: l.name,
    x: l.map?.x,
    y: l.map?.y,
    floor: l.map?.floor,
    hasCoords: !!l.map,
    knownAtStart: !!l.knownAtStart,
    sealed: l.startsAccessible === false,
    isStart: l.id === startId,
    exits: (l.exits ?? []).map((e) => ({
      to: e.toLocationId,
      gated:
        !!e.startsClosed || (e.requiresEvidenceIds?.length ?? 0) > 0,
    })),
  }));

  return (
    <>
      {def.locations.length > 0 && (
        <div className="section">
          <h3>Floor plan</h3>
          <div className="panel">
            <WorldMap rooms={worldRooms} />
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
