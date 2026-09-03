-- A retry or a double tap must resume the same unfinished plan day rather than
-- creating parallel sessions that compete for the same set logs.
create unique index if not exists workout_sessions_one_open_plan_day
  on public.workout_sessions (user_id, plan_id, day_index)
  where finished_at is null
    and plan_id is not null
    and day_index is not null;
