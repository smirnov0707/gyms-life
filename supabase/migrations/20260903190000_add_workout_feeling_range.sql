-- `feeling` is a deliberately small, user-reported completed-session signal.
-- Enforce the same 1–5 contract at the database boundary so a direct owned
-- API update cannot introduce a value the Digital Athlete model must discard.
alter table public.workout_sessions
  drop constraint if exists workout_sessions_feeling_range;

alter table public.workout_sessions
  add constraint workout_sessions_feeling_range
  check (feeling is null or feeling between 1 and 5) not valid;

alter table public.workout_sessions
  validate constraint workout_sessions_feeling_range;

comment on column public.workout_sessions.feeling is
  'Optional user-reported post-workout feeling from 1 (very difficult) to 5 (very good).';
