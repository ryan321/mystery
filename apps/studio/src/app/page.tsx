import Link from "next/link";
import { listCases, assetUrl } from "@/lib/content";
import { NewCaseButton } from "./new-case";

export const dynamic = "force-dynamic";

export default function Home() {
  const cases = listCases();
  return (
    <main className="wrap">
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 20 }}>
        <h1 className="case-title">The Shelf</h1>
        <span className="subtitle">
          {cases.length} definitions in content/cases
        </span>
        <span style={{ flex: 1 }} />
        <NewCaseButton />
      </div>
      <div className="grid">
        {cases.map((c) => (
          <Link key={c.dir} href={`/case/${c.dir}`} className="card">
            {c.coverPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="cover"
                src={assetUrl(c.dir, c.coverPath)}
                alt=""
              />
            ) : (
              <div className="cover blank">no cover</div>
            )}
            <div className="body">
              <h2>{c.title}</h2>
              <div className="premise">
                {c.premise ? c.premise.slice(0, 160) : "—"}
              </div>
              <div className="meta">
                <span className="chip">v{c.contentVersion}</span>
                {c.valid ? (
                  <span className="chip ok">valid</span>
                ) : (
                  <span className="chip warn">
                    {c.errors.length} schema error
                    {c.errors.length === 1 ? "" : "s"}
                  </span>
                )}
                <span className="chip">{c.counts.characters} cast</span>
                {c.hiddenCharacters > 0 && (
                  <span className="chip gold">{c.hiddenCharacters} hidden</span>
                )}
                <span className="chip">{c.counts.locations} rooms</span>
                <span className="chip">{c.counts.beats} beats</span>
                <span className="chip">{c.counts.endings} endings</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
