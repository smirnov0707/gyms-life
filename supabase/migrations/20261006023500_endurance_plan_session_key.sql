alter table public.workout_sessions add column if not exists endurance_plan_session_key text;
alter table public.workout_sessions drop constraint if exists workout_sessions_endurance_plan_session_key_check,add constraint workout_sessions_endurance_plan_session_key_check check(endurance_plan_session_key is null or endurance_plan_session_key ~ '^w[0-9]+-s[0-9]+$');
