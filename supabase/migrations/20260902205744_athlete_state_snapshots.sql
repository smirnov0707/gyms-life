-- A versioned, app-owned representation of the validated Digital Athlete
-- state. Raw facts continue to live in their source tables; this table stores
-- only derived, user-visible aggregates for history and auditability.
create table public.athlete_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  schema_version text not null,
  state jsonb not null,
  state_fingerprint text not null,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint athlete_state_snapshots_schema_version_format
    check (schema_version ~ '^[1-9][0-9]*[.][0-9]+$'),
  constraint athlete_state_snapshots_state_object
    check (jsonb_typeof(state) = 'object'),
  constraint athlete_state_snapshots_fingerprint_length
    check (char_length(state_fingerprint) = 64),
  constraint athlete_state_snapshots_user_fingerprint_unique
    unique (user_id, state_fingerprint)
);

comment on table public.athlete_state_snapshots is
  'Validated, versioned Digital Athlete aggregates. Source facts remain in their domain tables.';

create index athlete_state_snapshots_user_computed_at_idx
  on public.athlete_state_snapshots (user_id, computed_at desc);

alter table public.athlete_state_snapshots enable row level security;

-- The browser may read only its own history. Snapshot writes are exclusively
-- server-side after validation, so a client cannot forge athlete state.
revoke all on table public.athlete_state_snapshots from anon, authenticated;
grant select on table public.athlete_state_snapshots to authenticated;
grant all on table public.athlete_state_snapshots to service_role;

create policy "Users can read their own athlete state history"
  on public.athlete_state_snapshots
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
