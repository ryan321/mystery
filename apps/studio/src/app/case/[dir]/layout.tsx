import { loadCase } from "@/lib/content";
import { CaseTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function CaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ dir: string }>;
}) {
  const { dir } = await params;
  const loaded = loadCase(dir);

  return (
    <main className="wrap">
      {loaded?.valid ? (
        <>
          <h1 className="case-title">{loaded.def.meta.title}</h1>
          <div className="subtitle">
            {loaded.def.id} · v{loaded.def.contentVersion} ·{" "}
            {loaded.def.meta.tone ?? "no tone set"}
          </div>
        </>
      ) : (
        <>
          <h1 className="case-title">{dir}</h1>
          <div className="subtitle" style={{ color: "var(--red)" }}>
            definition has schema errors — see Edit JSON
          </div>
        </>
      )}
      <CaseTabs dir={dir} />
      {children}
    </main>
  );
}
