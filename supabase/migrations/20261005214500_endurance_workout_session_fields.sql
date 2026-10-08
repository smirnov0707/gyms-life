-- Endurance OS 1.1: one workout session remains the canonical training event.
-- Endurance metadata is structured rather than hidden in notes/snapshots.

alter table public.workout_sessions
  add column if not exists activity_kind text,
  add column if not exists activity_environment text,
  add column if not exists activity_source text,
  add column if not exists distance_meters numeric,
  add column if not exists average_heart_rate_bpm integer,
  add column if not exists perceived_effort integer,
  add column if not exists elevation_gain_meters numeric,
  add column if not exists average_cadence_spm numeric;

alter table public.workout_sessions
  drop constraint if exists workout_sessions_activity_kind_check,
  add constraint workout_sessions_activity_kind_check
    check (activity_kind is null or activity_kind in ('run', 'walk', 'hike')),
  drop constraint if exists workout_sessions_activity_environment_check,
  add constraint workout_sessions_activity_environment_check
    check (activity_environment is null or activity_environment in ('outdoor', 'treadmill', 'indoor_track')),
  drop constraint if exists workout_sessions_activity_source_check,
  add constraint workout_sessions_activity_source_check
    check (activity_source is null or activity_source in ('manual', 'device', 'wearable', 'imported')),
  drop constraint if exists workout_sessions_distance_meters_check,
  add constraint workout_sessions_distance_meters_check
    check (distance_meters is null or (distance_meters > 0 and distance_meters <= 250000)),
  drop constraint if exists workout_sessions_average_hr_check,
  add constraint workout_sessions_average_hr_check
    check (average_heart_rate_bpm is null or average_heart_rate_bpm between 30 and 240),
  drop constraint if exists workout_sessions_perceived_effort_check,
  add constraint workout_sessions_perceived_effort_check
    check (perceived_effort is null or perceived_effort between 1 and 10),
  drop constraint if exists workout_sessions_elevation_gain_check,
  add constraint workout_sessions_elevation_gain_check
    check (elevation_gain_meters is null or elevation_gain_meters between 0 and 15000),
  drop constraint if exists workout_sessions_average_cadence_check,
  add constraint workout_sessions_average_cadence_check
    check (average_cadence_spm is null or average_cadence_spm between 40 and 260);

create index if not exists workout_sessions_user_endurance_finished_idx
  on public.workout_sessions (user_id, finished_at desc)
  where activity_kind is not null and finished_at is not null;
