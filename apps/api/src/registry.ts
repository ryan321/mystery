/**
 * Mystery registry — DB-backed bundle storage with an in-memory parse cache
 * (docs/MYSTERY_BUNDLES.md §3, §5).
 *
 * - Upload/import = rows in `mysteries` + `mystery_assets`; no restart.
 * - Playthroughs pin contentVersion; getDefinition(caseId, version) serves
 *   the pinned content forever.
 * - The cache returns the SAME parsed object per (caseId, version) —
 *   prompt-cache memoizations (staticCasePackJson) are WeakMap-keyed on
 *   object identity.
 * - Dev convenience: importDirectory() auto-imports content/cases/* at boot
 *   as published bundles, overwriting same-version rows when content
 *   changed (local iteration), but preserving status/access overrides.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  parseMysteryDefinition,
  type MysteryDefinition,
} from "@mystery/shared";
import type { Db } from "./db.js";
import {
  bundleChecksum,
  mimeForPath,
  parseBundle,
  type BundleAsset,
  BundleError,
} from "./bundle.js";
import { parseAccessPolicy, type AccessPolicy } from "./access.js";

export type MysteryStatus = "draft" | "published" | "retired";

export type MysteryRowMeta = {
  caseId: string;
  contentVersion: string;
  status: MysteryStatus;
  access: AccessPolicy;
};

export class MysteryRegistry {
  #pool: Db;
  /** `${caseId}@@${version}` → parsed definition (immutable per version). */
  #defCache = new Map<string, MysteryDefinition>();
  /** caseId → latest published version. */
  #latestCache = new Map<string, string>();

  constructor(pool: Db) {
    this.#pool = pool;
  }

  #invalidate(caseId: string, version?: string): void {
    if (version) this.#defCache.delete(`${caseId}@@${version}`);
    else {
      for (const key of [...this.#defCache.keys()]) {
        if (key.startsWith(`${caseId}@@`)) this.#defCache.delete(key);
      }
    }
    this.#latestCache.delete(caseId);
  }

  async latestPublishedVersion(caseId: string): Promise<string | undefined> {
    const cached = this.#latestCache.get(caseId);
    if (cached) return cached;
    const res = await this.#pool.query<{ content_version: string }>(
      `SELECT content_version FROM mysteries
       WHERE case_id = $1 AND status = 'published'
       ORDER BY created_at DESC LIMIT 1`,
      [caseId]
    );
    const version = res.rows[0]?.content_version;
    if (version) this.#latestCache.set(caseId, version);
    return version;
  }

  /**
   * Parsed definition for (caseId, version). Version omitted → latest
   * published. A pinned version that no longer exists falls back to the
   * latest published one (dev DBs get blown away; playthroughs may outlive
   * their content rows locally).
   */
  async getDefinition(
    caseId: string,
    version?: string
  ): Promise<MysteryDefinition | undefined> {
    const resolved = version ?? (await this.latestPublishedVersion(caseId));
    if (!resolved) return undefined;

    const key = `${caseId}@@${resolved}`;
    const hit = this.#defCache.get(key);
    if (hit) return hit;

    const res = await this.#pool.query<{ definition: unknown }>(
      `SELECT definition FROM mysteries
       WHERE case_id = $1 AND content_version = $2`,
      [caseId, resolved]
    );
    const raw = res.rows[0]?.definition;
    if (!raw) {
      // Pinned version missing → latest published fallback.
      if (version) return this.getDefinition(caseId);
      return undefined;
    }
    const def = parseMysteryDefinition(raw);
    this.#defCache.set(key, def);
    return def;
  }

  async getRowMeta(
    caseId: string,
    version?: string
  ): Promise<MysteryRowMeta | undefined> {
    const resolved = version ?? (await this.latestPublishedVersion(caseId));
    if (!resolved) return undefined;
    const res = await this.#pool.query<{
      status: string;
      access: unknown;
    }>(
      `SELECT status, access FROM mysteries
       WHERE case_id = $1 AND content_version = $2`,
      [caseId, resolved]
    );
    const row = res.rows[0];
    if (!row) return undefined;
    return {
      caseId,
      contentVersion: resolved,
      status: row.status as MysteryStatus,
      access: parseAccessPolicy(row.access),
    };
  }

  /** Latest published row per case (the shelf's raw material). */
  async listPublished(): Promise<
    (MysteryRowMeta & { definition: MysteryDefinition })[]
  > {
    const res = await this.#pool.query<{
      case_id: string;
      content_version: string;
      status: string;
      access: unknown;
    }>(
      `SELECT DISTINCT ON (case_id)
         case_id, content_version, status, access
       FROM mysteries WHERE status = 'published'
       ORDER BY case_id, created_at DESC`
    );
    const out: (MysteryRowMeta & { definition: MysteryDefinition })[] = [];
    for (const row of res.rows) {
      const definition = await this.getDefinition(
        row.case_id,
        row.content_version
      );
      if (!definition) continue;
      out.push({
        caseId: row.case_id,
        contentVersion: row.content_version,
        status: row.status as MysteryStatus,
        access: parseAccessPolicy(row.access),
        definition,
      });
    }
    return out;
  }

  async getAsset(
    caseId: string,
    version: string | undefined,
    path: string
  ): Promise<{ mime: string; bytes: Buffer } | undefined> {
    const resolved = version ?? (await this.latestPublishedVersion(caseId));
    if (!resolved) return undefined;
    const res = await this.#pool.query<{ mime: string; bytes: Buffer }>(
      `SELECT mime, bytes FROM mystery_assets
       WHERE case_id = $1 AND content_version = $2 AND path = $3`,
      [caseId, resolved, path]
    );
    const row = res.rows[0];
    return row ? { mime: row.mime, bytes: row.bytes } : undefined;
  }

  async #upsert(args: {
    definition: MysteryDefinition;
    definitionRaw: unknown;
    assets: BundleAsset[];
    checksum: string;
    status: MysteryStatus;
    /** Reject if the version exists with different content (uploads). */
    strictVersioning: boolean;
  }): Promise<{ caseId: string; contentVersion: string; changed: boolean }> {
    const { definition, checksum } = args;
    const caseId = definition.id;
    const contentVersion = definition.contentVersion;

    const existing = await this.#pool.query<{ checksum: string }>(
      `SELECT checksum FROM mysteries
       WHERE case_id = $1 AND content_version = $2`,
      [caseId, contentVersion]
    );
    const prior = existing.rows[0];
    if (prior && prior.checksum === checksum) {
      return { caseId, contentVersion, changed: false };
    }
    if (prior && args.strictVersioning) {
      throw new BundleError(
        `version ${contentVersion} of "${caseId}" already exists with different content — bump contentVersion`
      );
    }

    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO mysteries
           (case_id, content_version, status, definition, checksum)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (case_id, content_version) DO UPDATE SET
           definition = EXCLUDED.definition,
           checksum   = EXCLUDED.checksum,
           updated_at = now()`,
        [
          caseId,
          contentVersion,
          args.status,
          JSON.stringify(args.definitionRaw),
          checksum,
        ]
      );
      await client.query(
        `DELETE FROM mystery_assets
         WHERE case_id = $1 AND content_version = $2`,
        [caseId, contentVersion]
      );
      for (const a of args.assets) {
        await client.query(
          `INSERT INTO mystery_assets (case_id, content_version, path, mime, bytes)
           VALUES ($1, $2, $3, $4, $5)`,
          [caseId, contentVersion, a.path, a.mime, a.bytes]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }

    this.#invalidate(caseId, contentVersion);
    return { caseId, contentVersion, changed: true };
  }

  /** Upload path: validated zip → draft (or published) row. Strict versioning. */
  async importBundle(
    buffer: Buffer,
    opts: { status?: MysteryStatus } = {}
  ): Promise<{
    caseId: string;
    contentVersion: string;
    warnings: string[];
  }> {
    const parsed = parseBundle(buffer);
    const { caseId, contentVersion } = await this.#upsert({
      definition: parsed.definition,
      definitionRaw: JSON.parse(JSON.stringify(parsed.definition)),
      assets: parsed.assets,
      checksum: parsed.checksum,
      status: opts.status ?? "draft",
      strictVersioning: true,
    });
    return { caseId, contentVersion, warnings: parsed.warnings };
  }

  /**
   * Dev auto-import: content/cases/<dir>/definition.json + sibling asset
   * files → published rows. Same-version overwrite allowed (local editing);
   * unchanged content (checksum match) is skipped.
   */
  async importDirectory(contentRoot: string): Promise<string[]> {
    const imported: string[] = [];
    let entries: string[];
    try {
      entries = readdirSync(contentRoot);
    } catch {
      return imported;
    }
    for (const name of entries) {
      const dir = join(contentRoot, name);
      let defText: string;
      try {
        if (!statSync(dir).isDirectory()) continue;
        defText = readFileSync(join(dir, "definition.json"), "utf8");
      } catch {
        continue;
      }
      try {
        const raw = JSON.parse(defText) as unknown;
        const definition = parseMysteryDefinition(raw);
        const assets = collectDirAssets(dir);
        const checksum = bundleChecksum(defText, assets);
        await this.#upsert({
          definition,
          definitionRaw: raw,
          assets,
          checksum,
          status: "published",
          strictVersioning: false,
        });
        imported.push(definition.id);
      } catch (err) {
        console.warn(`Skip case ${name}:`, err);
      }
    }
    return imported;
  }

  async publish(
    caseId: string,
    version: string,
    access?: AccessPolicy
  ): Promise<boolean> {
    const res = await this.#pool.query(
      `UPDATE mysteries SET status = 'published', updated_at = now()
       WHERE case_id = $1 AND content_version = $2`,
      [caseId, version]
    );
    if (access) await this.setAccess(caseId, access);
    this.#invalidate(caseId);
    return (res.rowCount ?? 0) > 0;
  }

  /** Policy applies to the case as a whole (all versions). */
  async setAccess(caseId: string, access: AccessPolicy): Promise<void> {
    await this.#pool.query(
      `UPDATE mysteries SET access = $2::jsonb, updated_at = now()
       WHERE case_id = $1`,
      [caseId, JSON.stringify(access)]
    );
  }

  async grant(caseId: string, userId: string, kind: string): Promise<void> {
    await this.#pool.query(
      `INSERT INTO mystery_grants (case_id, user_id, kind)
       VALUES ($1, $2, $3)
       ON CONFLICT (case_id, user_id) DO UPDATE SET kind = EXCLUDED.kind`,
      [caseId, userId, kind]
    );
  }

  async revokeGrant(caseId: string, userId: string): Promise<void> {
    await this.#pool.query(
      `DELETE FROM mystery_grants WHERE case_id = $1 AND user_id = $2`,
      [caseId, userId]
    );
  }
}

/** Walk a case directory for asset files (everything except definition.json). */
function collectDirAssets(dir: string, prefix = ""): BundleAsset[] {
  const out: BundleAsset[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectDirAssets(full, rel));
      continue;
    }
    if (rel === "definition.json") continue;
    out.push({ path: rel, mime: mimeForPath(rel), bytes: readFileSync(full) });
  }
  return out;
}
