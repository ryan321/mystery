-- Mystery Bundles: DB registry, assets, grants (docs/MYSTERY_BUNDLES.md)

CREATE TABLE IF NOT EXISTS mysteries (
  case_id          text NOT NULL,
  content_version  text NOT NULL,
  status           text NOT NULL DEFAULT 'draft',   -- draft | published | retired
  definition       jsonb NOT NULL,
  access           jsonb NOT NULL DEFAULT '{"visibility":"public"}',
  checksum         text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, content_version)
);

CREATE INDEX IF NOT EXISTS idx_mysteries_status ON mysteries (status);

CREATE TABLE IF NOT EXISTS mystery_assets (
  case_id          text NOT NULL,
  content_version  text NOT NULL,
  path             text NOT NULL,                   -- "portraits/vale.jpg"
  mime             text NOT NULL,
  bytes            bytea NOT NULL,
  PRIMARY KEY (case_id, content_version, path),
  FOREIGN KEY (case_id, content_version)
    REFERENCES mysteries (case_id, content_version) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mystery_grants (
  case_id    text NOT NULL,
  user_id    text NOT NULL,                          -- anonymous session ids now
  kind       text NOT NULL DEFAULT 'playtest',       -- owner | purchased | gifted | playtest
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, user_id)
);

-- Progression + grandfathering: who started/solved which playthroughs.
ALTER TABLE playthroughs ADD COLUMN IF NOT EXISTS user_id text;
CREATE INDEX IF NOT EXISTS idx_playthroughs_user ON playthroughs (user_id);
