import { loadCase, assetUrl } from "@/lib/content";

export const dynamic = "force-dynamic";

/**
 * Relationship graph: deterministic circular layout, directed edges.
 * Solid gold = public/social surface; dashed = private (behavior only);
 * ring = known to the player at start.
 */
export default async function RelationshipsPage({
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
  const chars = def.characters;
  const W = 940;
  const H = 620;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) / 2 - 90;

  const pos = new Map<string, { x: number; y: number }>();
  chars.forEach((c, i) => {
    const angle = (i / chars.length) * Math.PI * 2 - Math.PI / 2;
    pos.set(c.id, {
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle),
    });
  });

  return (
    <>
      <div className="panel" style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 700 }}>
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#8b93a3" />
            </marker>
          </defs>

          {def.relationships.map((r) => {
            const a = pos.get(r.fromId);
            const b = pos.get(r.toId);
            if (!a || !b) return null;
            // shorten toward node edge; offset curve for readability
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const pad = 46;
            const x1 = a.x + (dx / len) * pad;
            const y1 = a.y + (dy / len) * pad;
            const x2 = b.x - (dx / len) * pad;
            const y2 = b.y - (dy / len) * pad;
            const mx = (x1 + x2) / 2 - dy / len * 22;
            const my = (y1 + y2) / 2 + dx / len * 22;
            return (
              <g key={r.id}>
                <path
                  d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                  fill="none"
                  stroke={r.public ? "#d9a441" : "#59607080"}
                  strokeWidth={1 + r.strength}
                  strokeDasharray={r.public ? undefined : "5 4"}
                  markerEnd="url(#arrow)"
                >
                  <title>
                    {r.fromId} → {r.toId}: {r.type}
                    {r.label ? ` — ${r.label}` : ""}
                    {r.notes ? `\n${r.notes}` : ""}
                  </title>
                </path>
                <text
                  x={mx}
                  y={my - 4}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill={r.public ? "#d9a441" : "#8b93a3"}
                >
                  {r.label ?? r.type}
                  {r.knownToPlayerByDefault ? " ◉" : ""}
                </text>
              </g>
            );
          })}

          {chars.map((c) => {
            const p = pos.get(c.id)!;
            const guilty = def.solution.guiltyPartyIds.includes(c.id);
            return (
              <g key={c.id}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={40}
                  fill="#1b1f27"
                  stroke={
                    guilty ? "#c96556" : c.knownAtStart === false ? "#d9a441" : "#3a4150"
                  }
                  strokeWidth={2}
                  strokeDasharray={c.knownAtStart === false ? "4 4" : undefined}
                />
                {c.portrait && (
                  <>
                    <clipPath id={`clip-${c.id}`}>
                      <circle cx={p.x} cy={p.y} r={37} />
                    </clipPath>
                    <image
                      href={assetUrl(dir, c.portrait)}
                      x={p.x - 37}
                      y={p.y - 37}
                      width={74}
                      height={74}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#clip-${c.id})`}
                    />
                  </>
                )}
                <text
                  x={p.x}
                  y={p.y + 58}
                  textAnchor="middle"
                  fontSize="12.5"
                  fill="#e3e6ec"
                >
                  {c.name}
                </text>
                <text
                  x={p.x}
                  y={p.y + 72}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#8b93a3"
                >
                  {c.storyRole ?? "suspect"}
                  {guilty ? " · guilty" : ""}
                  {c.knownAtStart === false ? " · hidden" : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="section">
        <h3>Edges</h3>
        <table className="plain">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Type</th>
              <th>Label</th>
              <th>Strength</th>
              <th>Visibility</th>
              <th>Notes (AI behavior)</th>
            </tr>
          </thead>
          <tbody>
            {def.relationships.map((r) => (
              <tr key={r.id}>
                <td>{r.fromId}</td>
                <td>{r.toId}</td>
                <td>{r.type}</td>
                <td>{r.label ?? ""}</td>
                <td>{r.strength}</td>
                <td>
                  {r.public ? "public" : "private"}
                  {r.knownToPlayerByDefault ? " · player knows at start" : ""}
                </td>
                <td style={{ color: "var(--dim)" }}>{r.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="subtitle" style={{ marginTop: 10 }}>
          Solid gold = social surface · dashed = private behavior · ◉ = player
          knows at start · dashed ring = hidden character
        </p>
      </div>
    </>
  );
}
