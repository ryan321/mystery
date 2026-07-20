import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { parseBundle, BundleError } from "./bundle.js";

const caseDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../content/cases/blackwood-inheritance"
);
const defText = readFileSync(join(caseDir, "definition.json"), "utf8");

/** Tiny valid PNG (1x1). */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

function defWithAssets(): {
  raw: Record<string, unknown>;
  assetPaths: string[];
} {
  const raw = JSON.parse(defText) as Record<string, unknown> & {
    characters: { portrait?: string }[];
    locations: { image?: string }[];
  };
  const assetPaths: string[] = [];
  for (const c of raw.characters) {
    if (c.portrait) assetPaths.push(c.portrait);
  }
  for (const l of raw.locations) {
    if (l.image) assetPaths.push(l.image);
  }
  return { raw, assetPaths };
}

function makeZip(
  entries: Record<string, Buffer | string>
): Buffer {
  const zip = new AdmZip();
  for (const [path, data] of Object.entries(entries)) {
    zip.addFile(path, Buffer.isBuffer(data) ? data : Buffer.from(data));
  }
  return zip.toBuffer();
}

function validEntries(): Record<string, Buffer | string> {
  const { raw, assetPaths } = defWithAssets();
  const entries: Record<string, Buffer | string> = {
    "definition.json": JSON.stringify(raw),
  };
  for (const p of assetPaths) entries[p] = PNG;
  return entries;
}

describe("parseBundle", () => {
  it("accepts a complete bundle and computes a stable checksum", () => {
    const zip = makeZip(validEntries());
    const a = parseBundle(zip);
    const b = parseBundle(makeZip(validEntries()));
    expect(a.definition.id).toBe("blackwood-inheritance");
    expect(a.checksum).toBe(b.checksum);
    expect(a.assets.length).toBeGreaterThan(0);
    expect(a.assets.every((x) => x.mime === "image/png")).toBe(true);
  });

  it("rejects a bundle without definition.json", () => {
    expect(() => parseBundle(makeZip({ "cover.jpg": PNG }))).toThrow(
      BundleError
    );
  });

  it("rejects missing referenced assets", () => {
    const entries = validEntries();
    const someAsset = Object.keys(entries).find((k) => k !== "definition.json")!;
    delete entries[someAsset];
    try {
      parseBundle(makeZip(entries));
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BundleError);
      expect((err as BundleError).issues.join(" ")).toContain(someAsset);
    }
  });

  it("rejects orphan files (except cover.*)", () => {
    const entries = validEntries();
    entries["extras/readme.txt"] = "hello";
    expect(() => parseBundle(makeZip(entries))).toThrow(BundleError);

    const withCover = validEntries();
    withCover["cover.png"] = PNG;
    expect(() => parseBundle(makeZip(withCover))).not.toThrow();
  });

  it("rejects images that are not actually images", () => {
    const entries = validEntries();
    const someAsset = Object.keys(entries).find((k) => k !== "definition.json")!;
    entries[someAsset] = "not an image";
    expect(() => parseBundle(makeZip(entries))).toThrow(BundleError);
  });

  it("rejects unsafe paths", () => {
    const entries = validEntries();
    entries["../evil.png"] = PNG;
    expect(() => parseBundle(makeZip(entries))).toThrow(BundleError);
  });

  it("warns when a label-only character's real name leaks into prose", () => {
    const { raw } = defWithAssets();
    const chars = (raw as { characters: Record<string, unknown>[] }).characters;
    const henshaw = chars.find((c) => c.id === "henshaw")!;
    henshaw.nameKnownAtStart = false;
    henshaw.introducedAs = "The Butler";
    const entries = validEntries();
    entries["definition.json"] = JSON.stringify(raw);
    const parsed = parseBundle(makeZip(entries));
    // Blackwood prose names Henshaw all over — the lint must flag it.
    expect(
      parsed.warnings.some((w) => w.includes("label-only character"))
    ).toBe(true);
  });
});
