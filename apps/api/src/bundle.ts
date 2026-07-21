/**
 * Mystery Bundle parsing & validation (docs/MYSTERY_BUNDLES.md §2, §4).
 *
 * A bundle is a zip: definition.json at the root plus every asset it
 * references (portraits, location images, optional cover.*). Validation
 * happens BEFORE anything is stored:
 *   - Zod-parse the definition (id cross-references included)
 *   - asset integrity: every referenced path exists; no orphan files
 *   - size caps and image magic-byte sniffing
 *   - leak lint (warnings, not rejections)
 */
import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import {
  parseMysteryDefinition,
  type MysteryDefinition,
} from "@mystery/shared";

export type BundleAsset = { path: string; mime: string; bytes: Buffer };

export type ParsedBundle = {
  definition: MysteryDefinition;
  assets: BundleAsset[];
  warnings: string[];
  checksum: string;
};

export class BundleError extends Error {
  issues: string[];
  constructor(message: string, issues: string[] = []) {
    super(message);
    this.issues = issues;
  }
}

const MAX_DEFINITION_BYTES = 2 * 1024 * 1024;
const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

const IMAGE_EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function mimeForPath(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot).toLowerCase() : "";
  return IMAGE_EXT_MIME[ext] ?? "application/octet-stream";
}

/** Magic-byte check for the image types we accept. */
function sniffImage(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.length >= 6 && bytes.toString("ascii", 0, 3) === "GIF") {
    return "image/gif";
  }
  return null;
}

/** Asset paths the definition references (relative to the bundle root). */
export function referencedAssetPaths(def: MysteryDefinition): Set<string> {
  const refs = new Set<string>();
  for (const c of def.characters) {
    if (c.portrait) refs.add(c.portrait);
  }
  for (const l of def.locations) {
    if (l.image) refs.add(l.image);
  }
  return refs;
}

function normalizeEntryPath(raw: string): string | null {
  const p = raw.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!p || p.endsWith("/")) return null;
  if (p.startsWith("/") || p.split("/").includes("..")) return null;
  return p;
}

function isCover(path: string): boolean {
  return /^cover\.(jpe?g|png|webp)$/i.test(path);
}

/** Leak lint — best-effort warnings, never rejections. */
export function lintBundle(def: MysteryDefinition): string[] {
  const warnings: string[] = [];
  const defText = JSON.stringify(def);

  // Label-only characters: the real name should appear exactly once (its
  // own `name` field). More occurrences = authored prose leaks the name.
  for (const c of def.characters) {
    if (c.nameKnownAtStart !== false) continue;
    const occurrences = defText.split(c.name).length - 1;
    if (occurrences > 1) {
      warnings.push(
        `label-only character "${c.id}" (${c.introducedAs ?? "no introducedAs"}): real name "${c.name}" appears ${occurrences}x in the definition — authored prose ships verbatim and will leak it`
      );
    }
    if (!c.introducedAs) {
      warnings.push(
        `label-only character "${c.id}" has nameKnownAtStart:false but no introducedAs label`
      );
    }
  }

  // Hidden characters (knownAtStart: false): their existence must not leak
  // through opening-package prose, which ships to every player at start.
  const startProse = [
    def.meta.premise,
    def.openingNarration,
    def.player.startingKnowledge,
    ...(def.player.briefing?.sections.map((s) => `${s.heading} ${s.text}`) ??
      []),
    ...def.locations.map((l) => l.description),
  ]
    .join("\n")
    .toLowerCase();
  for (const c of def.characters) {
    if (c.knownAtStart !== false) continue;
    for (const label of [c.name, c.introducedAs].filter(
      (x): x is string => Boolean(x)
    )) {
      if (startProse.includes(label.toLowerCase())) {
        warnings.push(
          `hidden character "${c.id}": "${label}" appears in opening prose (premise/narration/briefing/descriptions) — their existence will leak at start`
        );
      }
    }
    if (!c.entrance) {
      warnings.push(
        `hidden character "${c.id}" has no entrance and can only be revealed via reveal_character effects or co-presence — confirm a beat introduces them`
      );
    }
  }

  // Dead locations: every location must earn its place (MYSTERY_PRINCIPLES
  // §8d). A room with no inspectables, no discoverable evidence, no beat
  // references, and nobody scheduled there is a tax on the player's turns.
  const beatText = JSON.stringify(def.beats ?? []);
  const peopleLocations = new Set(
    def.characters.flatMap((c) =>
      [c.defaultLocationId, c.entrance?.atLocationId].filter(Boolean)
    )
  );
  for (const loc of def.locations) {
    const hasInspectables = loc.inspectables.length > 0;
    const hasEvidence = def.evidence.some(
      (e) => e.discoverableAt?.locationId === loc.id
    );
    const inBeats = beatText.includes(`"${loc.id}"`);
    const hasPeople = peopleLocations.has(loc.id);
    if (!hasInspectables && !hasEvidence && !inBeats && !hasPeople) {
      warnings.push(
        `location "${loc.id}" has no inspectables, no discoverable evidence, no beat references, and nobody stationed there — dead weight; give it a job or cut it`
      );
    }
  }

  // Solution summary echoed into player-facing prose.
  const probe = def.solution.summary.slice(0, 40).toLowerCase();
  if (probe.length >= 20) {
    const playerFacing = [
      def.openingNarration,
      def.meta.premise,
      ...def.locations.map((l) => l.description),
      ...def.characters.map((c) => c.shortBio ?? ""),
      ...(def.player.briefing?.sections.map((s) => s.text) ?? []),
    ]
      .join("\n")
      .toLowerCase();
    if (playerFacing.includes(probe)) {
      warnings.push(
        "solution.summary text appears in player-facing prose (openingNarration / descriptions / bios / briefing)"
      );
    }
  }

  return warnings;
}

export function bundleChecksum(
  definitionText: string,
  assets: BundleAsset[]
): string {
  const hash = createHash("sha256");
  hash.update(definitionText);
  for (const a of [...assets].sort((x, y) => x.path.localeCompare(y.path))) {
    hash.update(a.path);
    hash.update(a.bytes);
  }
  return hash.digest("hex");
}

/** Parse + validate a bundle zip. Throws BundleError on invalid bundles. */
export function parseBundle(buffer: Buffer): ParsedBundle {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new BundleError("not a valid zip archive");
  }

  const files = new Map<string, Buffer>();
  let total = 0;
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const path = normalizeEntryPath(entry.entryName);
    if (!path) {
      throw new BundleError(`unsafe or invalid path in archive: "${entry.entryName}"`);
    }
    const bytes = entry.getData();
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) {
      throw new BundleError("bundle exceeds 50MB total");
    }
    files.set(path, bytes);
  }

  const defBytes = files.get("definition.json");
  if (!defBytes) {
    throw new BundleError("bundle must contain definition.json at the root");
  }
  if (defBytes.length > MAX_DEFINITION_BYTES) {
    throw new BundleError("definition.json exceeds 2MB");
  }

  const definitionText = defBytes.toString("utf8");
  let definition: MysteryDefinition;
  try {
    definition = parseMysteryDefinition(JSON.parse(definitionText));
  } catch (err) {
    throw new BundleError(
      "definition.json failed validation",
      [err instanceof Error ? err.message : String(err)]
    );
  }

  const refs = referencedAssetPaths(definition);
  const issues: string[] = [];
  const assets: BundleAsset[] = [];

  for (const ref of refs) {
    if (!files.has(ref)) issues.push(`referenced asset missing: ${ref}`);
  }
  for (const [path, bytes] of files) {
    if (path === "definition.json") continue;
    if (!refs.has(path) && !isCover(path)) {
      issues.push(`orphan file not referenced by the definition: ${path}`);
      continue;
    }
    if (bytes.length > MAX_ASSET_BYTES) {
      issues.push(`asset exceeds 5MB: ${path}`);
      continue;
    }
    const sniffed = sniffImage(bytes);
    const byExt = mimeForPath(path);
    if (byExt.startsWith("image/") && !sniffed) {
      issues.push(`asset is not a valid image: ${path}`);
      continue;
    }
    assets.push({ path, mime: sniffed ?? byExt, bytes });
  }

  if (issues.length) {
    throw new BundleError("bundle failed validation", issues);
  }

  return {
    definition,
    assets,
    warnings: lintBundle(definition),
    checksum: bundleChecksum(definitionText, assets),
  };
}
