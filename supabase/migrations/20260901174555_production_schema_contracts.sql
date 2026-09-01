-- Production schema contracts for the server functions that are already part
-- of the application. All user-owned tables use RLS and user_id ownership.

alter table public.meal_plans
  add column if not exists lang text not null default 'lt';

alter table public.meal_plans
  add column if not exists i18n jsonb not null default '{}'::jsonb;

create table if not exists public.readiness_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  sleep_hours numeric not null check (sleep_hours between 0 and 24),
  energy integer not null check (energy between 1 and 5),
  soreness text not null check (soreness in ('none', 'mild', 'moderate', 'severe')),
  stress integer not null check (stress between 1 and 5),
  created_at timestamptz not null default now()
);

create index if not exists readiness_checkins_user_created_idx
  on public.readiness_checkins (user_id, created_at desc);

alter table public.readiness_checkins enable row level security;
revoke all on table public.readiness_checkins from anon;
grant select, insert, update, delete on table public.readiness_checkins to authenticated;
grant all on table public.readiness_checkins to service_role;
drop policy if exists "Users manage own readiness checkins" on public.readiness_checkins;
create policy "Users manage own readiness checkins"
  on public.readiness_checkins
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.reminders (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workout_time time not null default '18:00'::time,
  water_reminders boolean not null default true,
  pre_workout_alert boolean not null default true,
  evening_recovery boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.reminders enable row level security;
revoke all on table public.reminders from anon;
grant select, insert, update, delete on table public.reminders to authenticated;
grant all on table public.reminders to service_role;
drop policy if exists "Users manage own reminders" on public.reminders;
create policy "Users manage own reminders"
  on public.reminders
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.user_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_type text not null,
  severity text not null check (severity in ('info', 'positive', 'attention', 'critical')),
  title text not null,
  body text not null,
  fingerprint text not null,
  source jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'seen', 'dismissed', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

create index if not exists user_insights_user_status_created_idx
  on public.user_insights (user_id, status, created_at desc);

alter table public.user_insights enable row level security;
revoke all on table public.user_insights from anon;
grant select, insert, update, delete on table public.user_insights to authenticated;
grant all on table public.user_insights to service_role;
drop policy if exists "Users manage own insights" on public.user_insights;
create policy "Users manage own insights"
  on public.user_insights
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Paddle webhook idempotency is an internal concern. Do not expose it via the
-- Data API even though the table lives in the public schema.
revoke all on table public.paddle_webhook_events from anon, authenticated;
grant all on table public.paddle_webhook_events to service_role;

-- The RPC accepts a caller-controlled quota limit. It is not an application
-- boundary, so block direct Data API execution until a server-owned quota API
-- is introduced.
revoke all on function public.consume_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer) to service_role;
