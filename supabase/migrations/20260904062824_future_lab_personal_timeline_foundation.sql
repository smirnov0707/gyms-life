-- Future Lab Phase 1: canonical personal timeline index.
-- Source facts remain in their original domain tables; timeline rows are compact,
-- auditable references/normalized event summaries written only by trusted server code.

create table if not exists public.personal_timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null,
  timezone text,
  provenance text not null,
  quality text not null default 'unknown',
  source_system text not null,
  source_table text,
  source_reference text,
  schema_version text not null default '1.0',
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint personal_timeline_event_type_format check (event_type ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint personal_timeline_provenance check (provenance in ('known','measured','user_reported','device_reported','calculated','inferred','predicted','simulated','unknown')),
  constraint personal_timeline_quality check (quality in ('unknown','low','moderate','high')),
  constraint personal_timeline_schema_version_format check (schema_version ~ '^[1-9][0-9]*[.][0-9]+$'),
  constraint personal_timeline_summary_object check (jsonb_typeof(summary) = 'object')
);

create index if not exists personal_timeline_user_occurred_idx
  on public.personal_timeline_events(user_id, occurred_at desc);

create unique index if not exists personal_timeline_source_event_unique
  on public.personal_timeline_events(user_id, source_system, source_reference, event_type)
  where source_reference is not null;

alter table public.personal_timeline_events enable row level security;
revoke all on table public.personal_timeline_events from anon, authenticated;
grant select on table public.personal_timeline_events to authenticated;
grant all on table public.personal_timeline_events to service_role;

create policy personal_timeline_select_own
  on public.personal_timeline_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.personal_timeline_events is 'Canonical Future Lab timeline index. References normalized personal events without replacing source-of-truth domain records.';
