-- A training rhythm is a user-stated weekly preference for Today. It is not
-- a workout calendar and deliberately remains separate from browser-local
-- notification settings.
create or replace function public.training_rhythm_weekdays_are_unique(value smallint[])
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select cardinality(value) = (
    select count(distinct weekday)
    from unnest(value) as weekday
  );
$$;

revoke all on function public.training_rhythm_weekdays_are_unique(smallint[])
  from public, anon, authenticated;
grant execute on function public.training_rhythm_weekdays_are_unique(smallint[])
  to service_role;

create table public.training_rhythms (
  user_id uuid primary key references auth.users (id) on delete cascade,
  preferred_weekdays smallint[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_rhythms_weekday_count
    check (cardinality(preferred_weekdays) between 1 and 7),
  constraint training_rhythms_weekday_range
    check (preferred_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  constraint training_rhythms_weekdays_unique
    check (public.training_rhythm_weekdays_are_unique(preferred_weekdays))
);

comment on table public.training_rhythms is
  'Optional, user-reported usual training days for Today decisions; never a hard workout schedule.';

alter table public.training_rhythms enable row level security;

-- The browser may read only its own preference. All mutations flow through
-- authenticated server functions using the service role after input validation.
revoke all on table public.training_rhythms from anon, authenticated;
grant select on table public.training_rhythms to authenticated;
grant all on table public.training_rhythms to service_role;

create policy "Users can read their own training rhythm"
  on public.training_rhythms
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

alter table public.decision_evidence
  drop constraint if exists decision_evidence_key;

alter table public.decision_evidence
  add constraint decision_evidence_key
    check (evidence_key in (
      'active_training_plan', 'today_readiness', 'completed_workout_today',
      'sessions_last_7_days', 'load_modifier', 'model_data_quality',
      'active_life_context', 'recent_decision_feedback', 'training_rhythm'
    )) not valid;

alter table public.decision_evidence
  validate constraint decision_evidence_key;
