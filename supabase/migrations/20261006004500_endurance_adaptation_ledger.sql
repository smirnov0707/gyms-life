create table if not exists public.endurance_adaptation_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  race_goal_id uuid not null references public.endurance_race_goals(id) on delete cascade,
  decision_on date not null,
  action text not null check (action in ('hold','reduce','recover')),
  volume_modifier numeric not null check (volume_modifier > 0 and volume_modifier <= 1),
  reason text not null check (
    reason in (
      'insufficient_evidence',
      'on_track',
      'repeated_low_response',
      'low_readiness_and_missed_work',
      'repeated_over_target_work'
    )
  ),
  evidence jsonb not null,
  engine_version text not null,
  decision_fingerprint text not null check (decision_fingerprint ~ '^[a-f0-9]{32}$'),
  created_at timestamptz not null default now()
);

create unique index if not exists endurance_adaptation_decision_fingerprint_uidx
  on public.endurance_adaptation_records(
    user_id,
    race_goal_id,
    decision_on,
    engine_version,
    decision_fingerprint
  );

alter table public.endurance_adaptation_records enable row level security;

revoke all on table public.endurance_adaptation_records from anon;
grant select on table public.endurance_adaptation_records to authenticated;
grant all on table public.endurance_adaptation_records to service_role;

drop policy if exists "Users read own endurance adaptations" on public.endurance_adaptation_records;
create policy "Users read own endurance adaptations"
  on public.endurance_adaptation_records
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.endurance_adaptation_records is
  'Immutable audit ledger for deterministic endurance plan adaptation decisions.';
