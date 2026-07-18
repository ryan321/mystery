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
  for (const file of ["001_init.sql", "002_state_json.sql"]) {
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
};

function rowToState(row: PlaythroughRow): PlaythroughState {
  if (row.state_json && typeof row.state_json === "object") {
    return PlaythroughStateSchema.parse(row.state_json);
  }
  // Legacy rows without state_json
  return PlaythroughStateSchema.parse({
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
): Promise<{ state: PlaythroughState; openingNarration: string } | null> {
  const res = await pool.query<PlaythroughRow>(
    `SELECT * FROM playthroughs WHERE id = $1`,
    [id]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    state: rowToState(row),
    openingNarration: row.opening_narration,
  };
}

export async function updatePlaythrough(
  pool: Db,
  state: PlaythroughState
): Promise<void> {
  const res = await pool.query(
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

export async function insertTurn(
  pool: Db,
  args: {
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
  }
): Promise<void> {
  await pool.query(
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

export async function listTurns(pool: Db, playthroughId: string) {
  const res = await pool.query(
    `SELECT turn_index, player_input, narration, dialogue, evidence_added, created_at
     FROM turns WHERE playthrough_id = $1 ORDER BY turn_index ASC`,
    [playthroughId]
  );
  return res.rows;
}
