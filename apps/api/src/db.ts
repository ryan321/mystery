import pg from "pg";
import type { PlaythroughState } from "@mystery/shared";
import { PlaythroughStateSchema } from "@mystery/shared";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;

export type Db = pg.Pool;

export function databaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string {
  return (
    env.DATABASE_URL ??
    env.MYSTERY_DATABASE_URL ??
    "postgres://localhost:5432/mystery"
  );
}

export function createPool(url: string = databaseUrl()): Db {
  return new Pool({ connectionString: url });
}

export async function migrate(pool: Db): Promise<void> {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "../sql");
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  for (const file of [
    "001_init.sql",
    "002_state_json.sql",
    "003_denouement_status.sql",
    "004_mysteries.sql",
    "005_billing.sql",
    "006_google_auth.sql",
  ]) {
    const sql = readFileSync(join(dir, file), "utf8");
    await pool.query(sql);
  }
}

type PlaythroughRow = {
  id: string;
  case_id: string;
  content_version: string;
  status: string;
  location_id: string;
  evidence_ids: unknown;
  flags: unknown;
  notebook: unknown;
  character_memory: unknown;
  visited_location_ids: unknown;
  turn_count: number;
  opening_narration: string;
  created_at: Date;
  updated_at: Date;
  state_json: unknown;
  phase_id: string | null;
  user_id: string | null;
};

/**
 * Repair common nulls / partials in persisted state before Zod parse.
 * Prevents one bad field (e.g. pressure: null) from permanently blocking load.
 */
function characterStateNeedsRepair(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const csRaw = (raw as Record<string, unknown>).characterState;
  if (!csRaw || typeof csRaw !== "object" || Array.isArray(csRaw)) return false;
  for (const entry of Object.values(csRaw as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const c = entry as Record<string, unknown>;
    if (
      c.pressure == null ||
      c.trust == null ||
      (typeof c.pressure === "number" && Number.isNaN(c.pressure)) ||
      (typeof c.trust === "number" && Number.isNaN(c.trust)) ||
      c.timesTalked == null ||
      c.available == null ||
      c.willingness == null ||
      c.stance == null ||
      c.alibiStatus == null
    ) {
      return true;
    }
  }
  return false;
}

function sanitizeStateJson(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const state = { ...(raw as Record<string, unknown>) };

  // A NaN clock value persists as JSON null and would fail the schema on
  // every read, bricking the playthrough — drop corrupt entries instead.
  const clocksRaw = state.clocks;
  if (clocksRaw && typeof clocksRaw === "object" && !Array.isArray(clocksRaw)) {
    state.clocks = Object.fromEntries(
      Object.entries(clocksRaw as Record<string, unknown>).filter(
        ([, v]) => typeof v === "number" && Number.isFinite(v)
      )
    );
  }

  const csRaw = state.characterState;
  if (csRaw && typeof csRaw === "object" && !Array.isArray(csRaw)) {
    const nextCs: Record<string, unknown> = {
      ...(csRaw as Record<string, unknown>),
    };
    for (const [id, entry] of Object.entries(nextCs)) {
      if (!entry || typeof entry !== "object") continue;
      const c = { ...(entry as Record<string, unknown>) };
      if (c.pressure == null || (typeof c.pressure === "number" && Number.isNaN(c.pressure))) {
        c.pressure = 0;
      }
      if (c.trust == null || (typeof c.trust === "number" && Number.isNaN(c.trust))) {
        c.trust = 0;
      }
      if (c.timesTalked == null) c.timesTalked = 0;
      if (c.available == null) c.available = true;
      if (c.willingness == null) c.willingness = "open";
      // Off-enum inventions ("defensive") persisted by older engines
      // would fail every read; coerce to the nearest legal value.
      if (!["open", "guarded", "hostile", "silent", "fled"].includes(c.willingness as string))
        c.willingness = "guarded";
      if (c.stance == null) c.stance = "";
      if (c.alibiStatus == null) c.alibiStatus = "none";
      nextCs[id] = c;
    }
    state.characterState = nextCs;
  }

  return state;
}

function parsePlaythroughState(raw: unknown): PlaythroughState {
  return PlaythroughStateSchema.parse(sanitizeStateJson(raw));
}

function rowToState(row: PlaythroughRow): PlaythroughState {
  if (row.state_json && typeof row.state_json === "object") {
    return parsePlaythroughState(row.state_json);
  }
  // Legacy rows without state_json
  return parsePlaythroughState({
    id: row.id,
    caseId: row.case_id,
    contentVersion: row.content_version,
    status: row.status,
    locationId: row.location_id,
    evidenceIds: row.evidence_ids,
    flags: row.flags,
    notebook: row.notebook,
    characterMemory: row.character_memory,
    visitedLocationIds: row.visited_location_ids,
    turnCount: row.turn_count,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
    phaseId: row.phase_id ?? "arrival",
  });
}

export async function insertPlaythrough(
  pool: Db,
  state: PlaythroughState,
  openingNarration: string
): Promise<void> {
  await pool.query(
    `INSERT INTO playthroughs (
      id, case_id, content_version, status, location_id,
      evidence_ids, flags, notebook, character_memory, visited_location_ids,
      turn_count, opening_narration, created_at, updated_at, state_json, phase_id
    ) VALUES (
      $1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,
      $11,$12,$13,$14,$15::jsonb,$16
    )`,
    [
      state.id,
      state.caseId,
      state.contentVersion,
      state.status,
      state.locationId,
      JSON.stringify(state.evidenceIds),
      JSON.stringify(state.flags),
      JSON.stringify(state.notebook),
      JSON.stringify(state.characterMemory),
      JSON.stringify(state.visitedLocationIds),
      state.turnCount,
      openingNarration,
      state.createdAt,
      state.updatedAt,
      JSON.stringify(state),
      state.phaseId,
    ]
  );
}

export async function getPlaythrough(
  pool: Db,
  id: string
): Promise<{
  state: PlaythroughState;
  openingNarration: string;
  userId: string | null;
} | null> {
  let res;
  try {
    res = await pool.query<PlaythroughRow>(
      `SELECT * FROM playthroughs WHERE id = $1`,
      [id]
    );
  } catch (err) {
    // Non-UUID path params fail the uuid cast (pg 22P02) — that's a
    // not-found, not a server error.
    if ((err as { code?: string }).code === "22P02") return null;
    throw err;
  }
  const row = res.rows[0];
  if (!row) return null;
  const state = rowToState(row);
  // One-time rewrite when characterState had nulls that used to hard-fail parse.
  if (
    row.state_json &&
    typeof row.state_json === "object" &&
    characterStateNeedsRepair(row.state_json)
  ) {
    try {
      await updatePlaythrough(pool, {
        ...state,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      /* load still succeeds even if rewrite fails */
    }
  }
  return {
    state,
    openingNarration: row.opening_narration,
    userId: row.user_id ?? null,
  };
}

export type PlaythroughSummary = {
  id: string;
  caseId: string;
  status: string;
  turnCount: number;
  updatedAt: string;
};

/**
 * Every playthrough owned by this user (or anon id), newest first.
 * Backs the account-wide "My mysteries" list — localStorage only tracks
 * the current browser, the DB is the cross-device source of truth.
 */
export async function listPlaythroughsFor(
  pool: Db,
  userId: string
): Promise<PlaythroughSummary[]> {
  const res = await pool.query<{
    id: string;
    case_id: string;
    status: string;
    turn_count: number;
    updated_at: Date;
  }>(
    `SELECT id, case_id, status, turn_count, updated_at
     FROM playthroughs
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 100`,
    [userId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    status: r.status,
    turnCount: r.turn_count,
    updatedAt:
      r.updated_at instanceof Date
        ? r.updated_at.toISOString()
        : String(r.updated_at),
  }));
}

/**
 * The user's open run for a case (active or denouement), if any. One
 * investigation per mystery per user: a second start resumes this run
 * instead of spawning a parallel one.
 */
export async function findOpenPlaythroughFor(
  pool: Db,
  userId: string,
  caseId: string
): Promise<string | null> {
  const res = await pool.query<{ id: string }>(
    `SELECT id FROM playthroughs
     WHERE user_id = $1 AND case_id = $2
       AND status IN ('active', 'denouement')
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, caseId]
  );
  return res.rows[0]?.id ?? null;
}

/** Explicit restart: close any open runs for the case as abandoned. */
export async function abandonOpenPlaythroughsFor(
  pool: Db,
  userId: string,
  caseId: string
): Promise<void> {
  await pool.query(
    `UPDATE playthroughs SET status = 'abandoned', updated_at = now()
     WHERE user_id = $1 AND case_id = $2
       AND status IN ('active', 'denouement')`,
    [userId, caseId]
  );
}

export type TurnWindowCounts = {  last10s: number;
  last60s: number;
  last24h: number;
};

/**
 * Recent turn volume for rate limiting. Keyed on the owning user when the
 * playthrough has one; legacy pre-account (anonymous) runs fall back to
 * per-playthrough counting so they stay playable but still bounded.
 */
export async function countRecentTurns(
  pool: Db,
  key: { userId: string } | { playthroughId: string }
): Promise<TurnWindowCounts> {
  const windows = `
    count(*) FILTER (WHERE t.created_at > now() - interval '10 seconds')::int AS last_10s,
    count(*) FILTER (WHERE t.created_at > now() - interval '60 seconds')::int AS last_60s,
    count(*) FILTER (WHERE t.created_at > now() - interval '24 hours')::int AS last_24h`;
  const res =
    "userId" in key
      ? await pool.query(
          `SELECT ${windows}
           FROM turns t
           JOIN playthroughs p ON p.id = t.playthrough_id
           WHERE p.user_id = $1
             AND t.created_at > now() - interval '24 hours'`,
          [key.userId]
        )
      : await pool.query(
          `SELECT ${windows}
           FROM turns t
           WHERE t.playthrough_id = $1
             AND t.created_at > now() - interval '24 hours'`,
          [key.playthroughId]
        );
  const row = res.rows[0] ?? {};
  return {
    last10s: Number(row.last_10s ?? 0),
    last60s: Number(row.last_60s ?? 0),
    last24h: Number(row.last_24h ?? 0),
  };
}

type Queryable = {
  query: pg.Pool["query"];
};

export async function updatePlaythrough(
  client: Queryable,
  state: PlaythroughState
): Promise<void> {
  const res = await client.query(
    `UPDATE playthroughs SET
      status = $2,
      location_id = $3,
      evidence_ids = $4::jsonb,
      flags = $5::jsonb,
      notebook = $6::jsonb,
      character_memory = $7::jsonb,
      visited_location_ids = $8::jsonb,
      turn_count = $9,
      updated_at = $10,
      state_json = $11::jsonb,
      phase_id = $12
    WHERE id = $1 AND turn_count = $13`,
    [
      state.id,
      state.status,
      state.locationId,
      JSON.stringify(state.evidenceIds),
      JSON.stringify(state.flags),
      JSON.stringify(state.notebook),
      JSON.stringify(state.characterMemory),
      JSON.stringify(state.visitedLocationIds),
      state.turnCount,
      state.updatedAt,
      JSON.stringify(state),
      state.phaseId,
      state.turnCount - 1,
    ]
  );
  if (res.rowCount !== 1) {
    throw new Error("playthrough_conflict");
  }
}

/**
 * Scratchpad-only write (PLAYER_SURFACES.md §5.6). Player notes are inert —
 * they never touch turn machinery, so no turn_count optimistic lock. Last
 * write wins; the web UI disables note editing while a turn is in flight.
 * Patches both the notebook column and state_json (the authoritative copy).
 */
export async function updateNotebook(
  pool: Db,
  playthroughId: string,
  notebook: PlaythroughState["notebook"]
): Promise<void> {
  await pool.query(
    `UPDATE playthroughs SET
      notebook = $2::jsonb,
      state_json = jsonb_set(state_json, '{notebook}', $2::jsonb),
      updated_at = $3
    WHERE id = $1`,
    [playthroughId, JSON.stringify(notebook), new Date().toISOString()]
  );
}

export type InsertTurnArgs = {
  playthroughId: string;
  turnIndex: number;
  playerInput: string;
  narration: string;
  dialogue: unknown;
  appliedPatch: unknown;
  rejected: unknown;
  evidenceAdded: unknown;
  model: string | null;
  mock: boolean;
  latencyMs: number | null;
};

export async function insertTurn(
  client: Queryable,
  args: InsertTurnArgs
): Promise<void> {
  await client.query(
    `INSERT INTO turns (
      playthrough_id, turn_index, player_input, narration, dialogue,
      applied_patch, rejected, evidence_added, model, mock, latency_ms
    ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11)`,
    [
      args.playthroughId,
      args.turnIndex,
      args.playerInput,
      args.narration,
      JSON.stringify(args.dialogue),
      JSON.stringify(args.appliedPatch),
      JSON.stringify(args.rejected),
      JSON.stringify(args.evidenceAdded),
      args.model,
      args.mock,
      args.latencyMs,
    ]
  );
}

/**
 * Atomically persist playthrough snapshot + turn log (optimistic lock on turn_count).
 */
export async function commitTurn(
  pool: Db,
  state: PlaythroughState,
  turn: InsertTurnArgs
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await updatePlaythrough(client, state);
    await insertTurn(client, turn);
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function listTurns(pool: Db, playthroughId: string) {
  const res = await pool.query(
    `SELECT turn_index, player_input, narration, dialogue, evidence_added, created_at
     FROM turns WHERE playthrough_id = $1 ORDER BY turn_index ASC`,
    [playthroughId]
  );
  return res.rows;
}
