#!/usr/bin/env node
/**
 * Zip a content/cases/<caseId> directory into a Mystery Bundle and upload it.
 *
 *   pnpm publish-case <caseId> [--api http://localhost:8787] [--publish]
 *
 * Sends X-Admin-Token from ADMIN_TOKEN env when set.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const args = process.argv.slice(2);
const caseId = args.find((a) => !a.startsWith("--"));
const api =
  args[args.indexOf("--api") + 1 || -1] && args.includes("--api")
    ? args[args.indexOf("--api") + 1]
    : "http://localhost:8787";
const publish = args.includes("--publish");

if (!caseId) {
  console.error("usage: pnpm publish-case <caseId> [--api URL] [--publish]");
  process.exit(1);
}

const dir = join(repoRoot, "content/cases", caseId);
const zip = new AdmZip();
function addDir(d, prefix = "") {
  for (const name of readdirSync(d)) {
    if (name.startsWith(".")) continue;
    const full = join(d, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) addDir(full, rel);
    else zip.addFile(rel, readFileSync(full));
  }
}
addDir(dir);

const res = await fetch(`${api}/v1/mysteries?publish=${publish}`, {
  method: "POST",
  headers: {
    "content-type": "application/zip",
    ...(process.env.ADMIN_TOKEN
      ? { "x-admin-token": process.env.ADMIN_TOKEN }
      : {}),
  },
  body: zip.toBuffer(),
});

const body = await res.json();
if (!res.ok) {
  console.error(`Upload failed (${res.status}):`, JSON.stringify(body, null, 2));
  process.exit(1);
}
console.log(
  `Uploaded ${body.caseId}@${body.contentVersion} (${body.status})` +
    (body.warnings?.length ? `\nWarnings:\n- ${body.warnings.join("\n- ")}` : "")
);
