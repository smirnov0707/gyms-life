alter table public.athlete_state_snapshots
  drop constraint athlete_state_snapshots_schema_version_format;

alter table public.athlete_state_snapshots
  add constraint athlete_state_snapshots_schema_version_format
  check (schema_version ~ '^[1-9][0-9]*[.][0-9]+$');
