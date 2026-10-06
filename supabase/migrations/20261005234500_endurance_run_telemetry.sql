create table if not exists public.endurance_run_imports (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
 source text not null check(source in ('apple_health','garmin','strava','device','manual_import')),
 external_activity_id text not null,
 split_coverage numeric not null check(split_coverage between 0 and 1),
 created_at timestamptz not null default now(),
 unique(user_id,source,external_activity_id)
);
create table if not exists public.endurance_run_splits (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
 split_index integer not null check(split_index>0),
 distance_meters numeric not null check(distance_meters>0),
 duration_seconds numeric not null check(duration_seconds>0),
 average_heart_rate_bpm integer check(average_heart_rate_bpm between 30 and 240),
 elevation_gain_meters numeric check(elevation_gain_meters>=0),
 cadence_spm numeric check(cadence_spm between 40 and 260),
 unique(workout_session_id,split_index)
);
alter table public.endurance_run_imports enable row level security;
alter table public.endurance_run_splits enable row level security;
revoke all on table public.endurance_run_imports,public.endurance_run_splits from anon;
grant select on table public.endurance_run_imports,public.endurance_run_splits to authenticated;
grant all on table public.endurance_run_imports,public.endurance_run_splits to service_role;
create policy "Users read own run imports" on public.endurance_run_imports for select to authenticated using((select auth.uid())=user_id);
create policy "Users read own run splits" on public.endurance_run_splits for select to authenticated using((select auth.uid())=user_id);
create index if not exists endurance_run_splits_session_idx on public.endurance_run_splits(workout_session_id,split_index);
