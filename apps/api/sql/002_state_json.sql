-- Full playthrough simulation state (entity + time + environment + beats)
ALTER TABLE playthroughs
  ADD COLUMN IF NOT EXISTS state_json JSONB;

ALTER TABLE playthroughs
  ADD COLUMN IF NOT EXISTS phase_id TEXT DEFAULT 'arrival';
