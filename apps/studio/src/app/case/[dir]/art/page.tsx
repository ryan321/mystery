import { loadCase, coverFor, assetUrl } from "@/lib/content";
import { Zoomable } from "@/app/zoomable";

export const dynamic = "force-dynamic";

/** All the bundle's imagery in one place — with missing-asset callouts. */
export default async function ArtPage({
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
  const cover = coverFor(dir);

  const withPortrait = def.characters.filter(
    (c): c is (typeof def.characters)[number] & { portrait: string } =>
      !!c.portrait
  );
  const withoutPortrait = def.characters.filter((c) => !c.portrait);
  const withImage = def.locations.filter(
    (l): l is (typeof def.locations)[number] & { image: string } => !!l.image
  );
  const withoutImage = def.locations.filter((l) => !l.image);

  return (
    <>
      {def.meta.artStyle && (
        <div className="section">
          <h3>Art direction</h3>
          <div className="prose">
            <p style={{ color: "var(--dim)" }}>{def.meta.artStyle}</p>
          </div>
        </div>
      )}

      <div className="section">
        <h3>Cover</h3>
        {cover ? (
          <div className="panel" style={{ padding: 0, overflow: "hidden", maxWidth: 720 }}>
            <Zoomable
              src={assetUrl(dir, cover)}
              alt={`${def.meta.title} cover`}
              caption={`content/cases/${dir}/${cover}`}
              style={{ width: "100%", display: "block" }}
            />
            <div style={{ padding: "10px 14px", color: "var(--dim)", fontFamily: "var(--mono)", fontSize: 12 }}>
              content/cases/{dir}/{cover}
            </div>
          </div>
        ) : (
          <div className="panel">
            <span className="status-err">
              No cover — drop a cover.jpg / cover.png into content/cases/{dir}/
            </span>
          </div>
        )}
      </div>

      <div className="section">
        <h3>
          Portraits ({withPortrait.length}/{def.characters.length})
        </h3>
        <div className="grid">
          {withPortrait.map((c) => (
            <div className="card" key={c.id}>
              <Zoomable
                className="cover"
                style={{ height: 240, objectPosition: "top" }}
                src={assetUrl(dir, c.portrait)}
                alt={c.name}
                caption={`${c.name} · ${c.portrait}`}
              />
              <div className="body">
                <h2 style={{ fontSize: 16 }}>{c.name}</h2>
                <div className="premise" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                  {c.portrait}
                </div>
                <div className="meta">
                  {c.knownAtStart === false && (
                    <span className="chip gold">hidden character</span>
                  )}
                  {def.solution.guiltyPartyIds.includes(c.id) && (
                    <span className="chip warn">guilty</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {withoutPortrait.length > 0 && (
          <div className="panel" style={{ marginTop: 12 }}>
            <span className="status-err">
              Missing portraits: {withoutPortrait.map((c) => c.name).join(", ")}
            </span>
          </div>
        )}
      </div>

      <div className="section">
        <h3>
          Location art ({withImage.length}/{def.locations.length})
        </h3>
        {withImage.length > 0 ? (
          <div className="grid">
            {withImage.map((l) => (
              <div className="card" key={l.id}>
                <Zoomable
                  className="cover"
                  src={assetUrl(dir, l.image)}
                  alt={l.name}
                  caption={`${l.name} · ${l.image}`}
                />
                <div className="body">
                  <h2 style={{ fontSize: 15 }}>{l.name}</h2>
                  <div className="premise" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                    {l.image}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="subtitle">No location establishing shots yet.</p>
        )}
        {withoutImage.length > 0 && (
          <p className="subtitle" style={{ marginTop: 10 }}>
            Without art: {withoutImage.map((l) => l.id).join(", ")}
          </p>
        )}
      </div>
    </>
  );
}
