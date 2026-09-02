-- The action-relevant facts (such as an active plan or today's check-in) can
-- change while the aggregate athlete snapshot remains identical. Persist a
-- deterministic decision fingerprint so a new factual situation creates a
-- distinct, auditable decision instead of reviving stale guidance.
alter table public.decision_records
  add column decision_fingerprint text;

alter table public.decision_records
  add constraint decision_records_fingerprint_length
  check (char_length(decision_fingerprint) = 64) not valid;

alter table public.decision_records
  alter column decision_fingerprint set not null;

alter table public.decision_records
  validate constraint decision_records_fingerprint_length;

alter table public.decision_records
  drop constraint decision_records_daily_snapshot_engine_unique;

alter table public.decision_records
  add constraint decision_records_daily_fingerprint_engine_unique
  unique (user_id, decision_on, decision_fingerprint, engine_version);
