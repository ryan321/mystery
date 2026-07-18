-- Mystery playthrough storage (local Postgres)

CREATE TABLE IF NOT EXISTS playthroughs (
  id UUID PRIMARY KEY,
  case_id TEXT NOT NULL,
  content_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'solved', 'failed', 'abandoned')),
  location_id TEXT NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  notebook JSONB NOT NULL DEFAULT '[]'::jsonb,
  character_memory JSONB NOT NULL DEFAULT '{}'::jsonb,
  visited_location_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  turn_count INT NOT NULL DEFAULT 0,
  opening_narration TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS playthroughs_case_id_idx ON playthroughs (case_id);
CREATE INDEX IF NOT EXISTS playthroughs_updated_at_idx ON playthroughs (updated_at DESC);

CREATE TABLE IF NOT EXISTS turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playthrough_id UUID NOT NULL REFERENCES playthroughs (id) ON DELETE CASCADE,
  turn_index INT NOT NULL,
  player_input TEXT NOT NULL,
  narration TEXT NOT NULL,
  dialogue JSONB NOT NULL DEFAULT '[]'::jsonb,
  applied_patch JSONB NOT NULL DEFAULT '{}'::jsonb,
  rejected JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_added JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  mock BOOLEAN NOT NULL DEFAULT false,
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (playthrough_id, turn_index)
);

CREATE INDEX IF NOT EXISTS turns_playthrough_id_idx ON turns (playthrough_id);
