alter table public.personalized_twin_capture_sets
  add column provider_submit_claim_token text,
  add column provider_submit_claim_until timestamptz,
  add column provider_poll_attempt integer not null default 0,
  add column provider_next_poll_at timestamptz,
  add column provider_terminal_lease_until timestamptz;

alter table public.personalized_twin_capture_sets
  add constraint personalized_twin_provider_poll_attempt_nonnegative
  check (provider_poll_attempt >= 0);

comment on column public.personalized_twin_capture_sets.provider_submit_claim_token is
  'Opaque server-side lease token used to prevent duplicate external provider submissions.';
comment on column public.personalized_twin_capture_sets.provider_submit_claim_until is
  'Expiry for the provider submission lease. Expired claims may be retried by trusted server code.';
comment on column public.personalized_twin_capture_sets.provider_poll_attempt is
  'Count of provider polling retries used to calculate bounded exponential backoff.';
comment on column public.personalized_twin_capture_sets.provider_next_poll_at is
  'Earliest time trusted server code should poll the external provider again.';
comment on column public.personalized_twin_capture_sets.provider_terminal_lease_until is
  'Short server-side lease that serializes polling and webhook terminalization.';
create schema if not exists private;

create table private.personalized_twin_provider_events (
  provider_key text not null,
  provider_job_id text not null,
  event_key text not null,
  capture_set_id uuid not null references public.personalized_twin_capture_sets(id) on delete cascade,
  received_at timestamptz not null default now(),
  primary key (provider_key, provider_job_id, event_key)
);

revoke all on schema private from public, anon, authenticated;
revoke all on table private.personalized_twin_provider_events from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, delete on table private.personalized_twin_provider_events to service_role;

comment on table private.personalized_twin_provider_events is
  'Server-only idempotency ledger for external Personalized Twin provider events. Not exposed to clients.';