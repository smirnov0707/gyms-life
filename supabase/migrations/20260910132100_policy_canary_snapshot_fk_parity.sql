-- Preserve the staging relation shape in addition to the composite owner guard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.policy_shadow_records'::regclass
      AND conname='policy_shadow_records_athlete_state_snapshot_id_fkey'
  ) THEN
    ALTER TABLE public.policy_shadow_records
      ADD CONSTRAINT policy_shadow_records_athlete_state_snapshot_id_fkey
      FOREIGN KEY(athlete_state_snapshot_id)
      REFERENCES public.athlete_state_snapshots(id) ON DELETE CASCADE;
  END IF;
END $$;