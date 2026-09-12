create table if not exists public.personal_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hypothesis_id text not null check (char_length(hypothesis_id) between 1 and 120),
  domain text not null check (domain in ('training_behavior','recovery_behavior','nutrition_behavior')),
  intervention text not null check (char_length(intervention) between 1 and 240),
  primary_outcome text not null check (char_length(primary_outcome) between 1 and 120),
  duration_days integer not null check (duration_days between 3 and 42),
  changed_variable_count integer not null check (changed_variable_count between 1 and 8),
  stop_conditions jsonb not null default '[]'::jsonb,
  governance jsonb not null,
  status text not null default 'draft' check (status in ('draft','eligible','running','stopped','completed')),
  started_at timestamptz,
  ended_at timestamptz,
  stop_reason text check (stop_reason is null or stop_reason in ('user_stopped','adverse_signal','protocol_deviation','insufficient_data')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);create table if not exists public.personal_experiment_outcomes (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.personal_experiments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  observed_at timestamptz not null,
  phase text not null check (phase in ('baseline','intervention','followup')),
  outcome_key text not null check (char_length(outcome_key) between 1 and 120),
  numeric_value double precision,
  text_value text,
  source text not null default 'gymslife' check (char_length(source) between 1 and 80),
  created_at timestamptz not null default now(),
  check (numeric_value is not null or text_value is not null)
);

create index if not exists personal_experiments_user_created_idx
  on public.personal_experiments(user_id, created_at desc);
create index if not exists personal_experiment_outcomes_experiment_observed_idx
  on public.personal_experiment_outcomes(experiment_id, observed_at);
create index if not exists personal_experiment_outcomes_user_observed_idx
  on public.personal_experiment_outcomes(user_id, observed_at desc);alter table public.personal_experiments enable row level security;
alter table public.personal_experiment_outcomes enable row level security;

revoke all on table public.personal_experiments from anon, authenticated;
revoke all on table public.personal_experiment_outcomes from anon, authenticated;
grant select, insert, update on table public.personal_experiments to authenticated;
grant select, insert on table public.personal_experiment_outcomes to authenticated;
grant all on table public.personal_experiments to service_role;
grant all on table public.personal_experiment_outcomes to service_role;

create policy personal_experiments_select_own on public.personal_experiments
for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_experiments_insert_own on public.personal_experiments
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_experiments_update_own on public.personal_experiments
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);create policy personal_experiment_outcomes_select_own on public.personal_experiment_outcomes
for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_experiment_outcomes_insert_own on public.personal_experiment_outcomes
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.personal_experiments e
    where e.id = experiment_id and e.user_id = (select auth.uid())
  )
);

comment on table public.personal_experiments is
  'User-owned low-risk N-of-1 experiment protocols governed by GYMS.LIFE; records never grant causal or automatic decision authority.';
comment on table public.personal_experiment_outcomes is
  'Longitudinal observations for personal experiments; append-only for authenticated users and interpreted as association evidence only.';