create table if not exists public.endurance_race_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  distance text not null check (distance in ('5k','10k','half_marathon','marathon')),
  race_date date not null,
  target_time_seconds integer check (target_time_seconds is null or target_time_seconds > 0),
  sessions_per_week integer not null check (sessions_per_week between 2 and 7),
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists endurance_one_active_goal_per_user
  on public.endurance_race_goals(user_id) where status = 'active';

alter table public.endurance_race_goals enable row level security;
revoke all on table public.endurance_race_goals from anon;
grant select on table public.endurance_race_goals to authenticated;
grant all on table public.endurance_race_goals to service_role;
drop policy if exists "Users manage own endurance race goals" on public.endurance_race_goals;
create policy "Users read own endurance race goals"
  on public.endurance_race_goals for select to authenticated
  using ((select auth.uid()) = user_id);
