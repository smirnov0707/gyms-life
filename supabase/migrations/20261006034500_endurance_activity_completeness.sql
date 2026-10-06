alter table public.workout_sessions
  drop constraint if exists workout_sessions_endurance_activity_completeness_check;

alter table public.workout_sessions
  add constraint workout_sessions_endurance_activity_completeness_check
  check (
    activity_kind is null
    or (
      activity_environment is not null
      and activity_source is not null
      and duration_seconds is not null
      and duration_seconds > 0
    )
  );
