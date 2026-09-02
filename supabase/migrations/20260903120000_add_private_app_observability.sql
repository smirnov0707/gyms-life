-- Server-owned operational telemetry. Events deliberately store only stable
-- codes and bounded scalar metadata: never prompts, health records, chat
-- content, provider responses, IP addresses, or raw error messages.
create table public.app_observability_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_name text not null,
  outcome text not null,
  user_id uuid references auth.users (id) on delete set null,
  duration_ms integer,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  constraint app_observability_events_event_name_format
    check (event_name ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint app_observability_events_outcome
    check (outcome in ('success', 'failure')),
  constraint app_observability_events_duration_range
    check (duration_ms is null or duration_ms between 0 and 86400000),
  constraint app_observability_events_error_code_format
    check (error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{2,99}$'),
  constraint app_observability_events_metadata_is_object
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.app_observability_events is
  'Server-owned operational telemetry with no raw user, health, prompt, or provider payloads.';

create index app_observability_events_name_created_idx
  on public.app_observability_events (event_name, created_at desc);

create index app_observability_events_failures_created_idx
  on public.app_observability_events (created_at desc)
  where outcome = 'failure';

create index app_observability_events_user_created_idx
  on public.app_observability_events (user_id, created_at desc);

alter table public.app_observability_events enable row level security;

-- This is an internal operational table. Browser roles have no access, and
-- deliberately no RLS policy is created. The server service role is limited
-- to append and read access for incident investigation.
revoke all on table public.app_observability_events from public, anon, authenticated, service_role;
grant select, insert on table public.app_observability_events to service_role;
