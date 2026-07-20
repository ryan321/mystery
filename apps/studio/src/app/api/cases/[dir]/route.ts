import { NextResponse } from "next/server";
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseMysteryDefinition } from "@mystery/shared";
import { contentRoot, loadCase } from "@/lib/content";

function safeDir(raw: string): string | null {
  const dir = decodeURIComponent(raw);
  return /^[a-z0-9][a-z0-9-]{0,60}$/.test(dir) ? dir : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dir: string }> }
) {
  const dir = safeDir((await params).dir);
  if (!dir) return NextResponse.json({ error: "bad_dir" }, { status: 400 });
  const loaded = loadCase(dir);
  if (!loaded) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    dir,
    valid: loaded.valid,
    errors: loaded.valid ? [] : loaded.errors,
    text: loaded.rawText,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ dir: string }> }
) {
  const dir = safeDir((await params).dir);
  if (!dir) return NextResponse.json({ error: "bad_dir" }, { status: 400 });
  const path = join(contentRoot, dir, "definition.json");
  if (!existsSync(path)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = String(body.text ?? "");

  // Validate before writing — the studio never saves a broken definition.
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
    parseMysteryDefinition(parsed);
  } catch (err) {
    const errors =
      err && typeof err === "object" && "issues" in err
        ? (
            err as { issues: { path: (string | number)[]; message: string }[] }
          ).issues.map(
            (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
          )
        : [err instanceof Error ? err.message : String(err)];
    return NextResponse.json({ error: "invalid", errors }, { status: 400 });
  }

  writeFileSync(path, text.endsWith("\n") ? text : text + "\n");
  return NextResponse.json({ saved: true });
}
