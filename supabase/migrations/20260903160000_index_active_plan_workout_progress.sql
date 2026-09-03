-- Serves the canonical Today active-plan progress read: resume the most
-- recent unfinished plan session without scanning completed history.
create index if not exists workout_sessions_user_plan_open_started_idx
  on public.workout_sessions (user_id, plan_id, started_at desc)
  where finished_at is null
    and plan_id is not null;

-- Serves both the latest completed plan session and the rolling seven-day
-- frequency count used by the deterministic Today decision engine.
create index if not exists workout_sessions_user_plan_finished_idx
  on public.workout_sessions (user_id, plan_id, finished_at desc)
  where finished_at is not null
    and plan_id is not null;
