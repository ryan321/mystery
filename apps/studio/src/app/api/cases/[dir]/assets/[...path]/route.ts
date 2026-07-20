import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve, normalize, extname } from "node:path";
import { contentRoot } from "@/lib/content";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dir: string; path: string[] }> }
) {
  const { dir, path } = await params;
  const rel = normalize(path.map(decodeURIComponent).join("/"));
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(dir) || rel.split("/").includes("..")) {
    return new Response("bad path", { status: 400 });
  }
  const caseRoot = resolve(contentRoot, dir);
  const full = resolve(caseRoot, rel);
  if (!full.startsWith(caseRoot + "/")) {
    return new Response("bad path", { status: 400 });
  }
  if (!existsSync(full) || !statSync(full).isFile()) {
    return new Response("not found", { status: 404 });
  }
  const bytes = readFileSync(full);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": MIME[extname(full).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    },
  });
}
