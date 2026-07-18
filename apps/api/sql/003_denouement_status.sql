-- Allow interactive wrap-up status (engine: active → denouement → solved/failed)

ALTER TABLE playthroughs DROP CONSTRAINT IF EXISTS playthroughs_status_check;

ALTER TABLE playthroughs
  ADD CONSTRAINT playthroughs_status_check
  CHECK (
    status IN (
      'active',
      'denouement',
      'solved',
      'failed',
      'abandoned'
    )
  );
