-- A server-owned, explainable record of the deterministic decision selected
-- for an athlete's day. The linked snapshot contains validated aggregates;
-- raw health and training facts remain in their source tables.
create table public.decision_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  athlete_state_snapshot_id uuid not null
    references public.athlete_state_snapshots (id) on delete cascade,
  decision_on date not null,
  engine_version text not null,
  decision_type text not null default 'today',
  action text not null,
  alternatives text[] not null default '{}',
  confidence smallint not null,
  safety_constraints text[] not null default '{}',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint decision_records_engine_version_format
    check (engine_version ~ '^[1-9][0-9]*[.][0-9]+$'),
  constraint decision_records_type
    check (decision_type = 'today'),
  constraint decision_records_action
    check (action in (
      'generate_training_plan',
      'complete_readiness',
      'recover',
      'train_adapted',
      'train_as_planned',
      'log_nutrition'
    )),
  constraint decision_records_alternatives_valid
    check (alternatives <@ array[
      'generate_training_plan',
      'complete_readiness',
      'recover',
      'train_adapted',
      'train_as_planned',
      'log_nutrition'
    ]::text[]),
  constraint decision_records_confidence_range
    check (confidence between 0 and 100),
  constraint decision_records_safety_constraints_valid
    check (safety_constraints <@ array[
      'requires_active_plan_before_training',
      'do_not_adapt_load_without_today_checkin',
      'avoid_progression_when_readiness_low',
      'apply_persisted_readiness_modifier',
      'avoid_duplicate_training_prompt'
    ]::text[]),
  constraint decision_records_status
    check (status in ('active', 'accepted', 'dismissed', 'completed', 'expired')),
  constraint decision_records_daily_snapshot_engine_unique
    unique (user_id, decision_on, athlete_state_snapshot_id, engine_version)
);

comment on table public.decision_records is
  'Server-owned, deterministic Today decisions linked to validated athlete-state snapshots.';

create index decision_records_user_decision_on_idx
  on public.decision_records (user_id, decision_on desc, created_at desc);

create table public.decision_evidence (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decision_records (id) on delete cascade,
  evidence_key text not null,
  evidence_value text not null,
  source_class text not null,
  position smallint not null,
  created_at timestamptz not null default now(),
  constraint decision_evidence_key
    check (evidence_key in (
      'active_training_plan',
      'today_readiness',
      'completed_workout_today',
      'sessions_last_7_days',
      'load_modifier',
      'model_data_quality'
    )),
  constraint decision_evidence_value_length
    check (char_length(evidence_value) between 1 and 100),
  constraint decision_evidence_source_class
    check (source_class in ('user_reported', 'calculated', 'system_generated')),
  constraint decision_evidence_position
    check (position between 0 and 10),
  constraint decision_evidence_decision_position_unique
    unique (decision_id, position)
);

comment on table public.decision_evidence is
  'Short, typed facts supporting a Today decision. It never stores AI-generated rationale.';

create index decision_evidence_decision_position_idx
  on public.decision_evidence (decision_id, position);

create table public.decision_outcomes (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null unique references public.decision_records (id) on delete cascade,
  outcome text not null,
  recorded_at timestamptz not null default now(),
  constraint decision_outcomes_outcome
    check (outcome in ('accepted', 'dismissed', 'completed', 'not_helpful'))
);

comment on table public.decision_outcomes is
  'One explicit athlete outcome for a Today decision; used for future, evidence-based evaluation.';

alter table public.decision_records enable row level security;
alter table public.decision_evidence enable row level security;
alter table public.decision_outcomes enable row level security;

-- Clients can inspect their own audit trail, but all writes are made only by
-- authenticated server functions after source validation and ownership checks.
revoke all on table public.decision_records from anon, authenticated;
revoke all on table public.decision_evidence from anon, authenticated;
revoke all on table public.decision_outcomes from anon, authenticated;

grant select on table public.decision_records to authenticated;
grant select on table public.decision_evidence to authenticated;
grant select on table public.decision_outcomes to authenticated;
grant all on table public.decision_records to service_role;
grant all on table public.decision_evidence to service_role;
grant all on table public.decision_outcomes to service_role;

create policy "Users can read their own decision records"
  on public.decision_records
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read evidence for their own decisions"
  on public.decision_evidence
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.decision_records
      where decision_records.id = decision_evidence.decision_id
        and decision_records.user_id = (select auth.uid())
    )
  );

create policy "Users can read outcomes for their own decisions"
  on public.decision_outcomes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.decision_records
      where decision_records.id = decision_outcomes.decision_id
        and decision_records.user_id = (select auth.uid())
    )
  );
