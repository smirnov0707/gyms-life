-- Covers the athlete-state foreign key for history joins and cascading erasure.
create index decision_records_athlete_state_snapshot_idx
  on public.decision_records (athlete_state_snapshot_id);
