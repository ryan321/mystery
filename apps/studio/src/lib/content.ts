import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseMysteryDefinition,
  type MysteryDefinition,
} from "@mystery/shared";

/** apps/studio/src/lib → repo root */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const contentRoot = join(repoRoot, "content/cases");

export type CaseSummary = {
  dir: string;
  id: string;
  title: string;
  contentVersion: string;
  premise: string;
  valid: boolean;
  errors: string[];
  counts: {
    characters: number;
    locations: number;
    evidence: number;
    beats: number;
    endings: number;
    relationships: number;
  };
  coverPath?: string;
  hiddenCharacters: number;
};

export type LoadedCase =
  | {
      dir: string;
      valid: true;
      def: MysteryDefinition;
      rawText: string;
    }
  | {
      dir: string;
      valid: false;
      errors: string[];
      rawText: string;
    };

export function caseDirs(): string[] {
  try {
    return readdirSync(contentRoot).filter((name) => {
      try {
        return (
          statSync(join(contentRoot, name)).isDirectory() &&
          existsSync(join(contentRoot, name, "definition.json"))
        );
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function zodErrors(err: unknown): string[] {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: { path: (string | number)[]; message: string }[] })
      .issues;
    return issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  }
  return [err instanceof Error ? err.message : String(err)];
}

export function loadCase(dir: string): LoadedCase | null {
  const path = join(contentRoot, dir, "definition.json");
  let rawText: string;
  try {
    rawText = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  try {
    const def = parseMysteryDefinition(JSON.parse(rawText));
    return { dir, valid: true, def, rawText };
  } catch (err) {
    return { dir, valid: false, errors: zodErrors(err), rawText };
  }
}

export function coverFor(dir: string): string | undefined {
  for (const name of ["cover.jpg", "cover.jpeg", "cover.png", "cover.webp"]) {
    if (existsSync(join(contentRoot, dir, name))) return name;
  }
  return undefined;
}

export function listCases(): CaseSummary[] {
  const out: CaseSummary[] = [];
  for (const dir of caseDirs()) {
    const loaded = loadCase(dir);
    if (!loaded) continue;
    if (loaded.valid) {
      const d = loaded.def;
      out.push({
        dir,
        id: d.id,
        title: d.meta.title,
        contentVersion: d.contentVersion,
        premise: d.meta.premise,
        valid: true,
        errors: [],
        counts: {
          characters: d.characters.length,
          locations: d.locations.length,
          evidence: d.evidence.length,
          beats: d.beats.length,
          endings: d.endings.length,
          relationships: d.relationships.length,
        },
        coverPath: coverFor(dir),
        hiddenCharacters: d.characters.filter((c) => c.knownAtStart === false)
          .length,
      });
    } else {
      out.push({
        dir,
        id: dir,
        title: dir,
        contentVersion: "?",
        premise: "",
        valid: false,
        errors: loaded.errors,
        counts: {
          characters: 0,
          locations: 0,
          evidence: 0,
          beats: 0,
          endings: 0,
          relationships: 0,
        },
        coverPath: coverFor(dir),
        hiddenCharacters: 0,
      });
    }
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

export function assetUrl(dir: string, path: string): string;
export function assetUrl(dir: string, path?: string): string | undefined;
export function assetUrl(dir: string, path?: string): string | undefined {
  return path
    ? `/api/cases/${encodeURIComponent(dir)}/assets/${path}`
    : undefined;
}
