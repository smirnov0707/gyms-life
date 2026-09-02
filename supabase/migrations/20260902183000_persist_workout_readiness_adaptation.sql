-- Snapshot the recovery adjustment when a workout starts. Completion and set
-- validation can then use the same plan even if a daily check-in changes later.
alter table public.workout_sessions
  add column if not exists adaptation_modifier numeric not null default 1;

alter table public.workout_sessions
  add constraint workout_sessions_adaptation_modifier_range
    check (adaptation_modifier >= 0.5 and adaptation_modifier <= 1.1) not valid;
