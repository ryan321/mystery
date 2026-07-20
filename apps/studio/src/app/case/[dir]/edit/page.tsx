import { loadCase } from "@/lib/content";
import { Editor } from "./editor";

export const dynamic = "force-dynamic";

export default async function EditPage({
  params,
}: {
  params: Promise<{ dir: string }>;
}) {
  const { dir } = await params;
  const loaded = loadCase(dir);
  if (!loaded) return <p className="status-err">definition.json not found.</p>;
  return (
    <Editor
      dir={dir}
      initialText={loaded.rawText}
      initialErrors={loaded.valid ? [] : loaded.errors}
    />
  );
}
