-- In-game player feedback (gameplay-screen "Send feedback" modal)

CREATE TABLE IF NOT EXISTS feedback (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playthrough_id UUID NOT NULL REFERENCES playthroughs (id) ON DELETE CASCADE,
  user_id        TEXT,                -- session user id or anon cookie id; NULL for legacy ownerless runs
  case_id        TEXT NOT NULL,
  turn_count     INT NOT NULL,
  feedback       TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at DESC);
