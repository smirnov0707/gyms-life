alter table public.workout_sessions
  add column if not exists endurance_session_intent text,
  add column if not exists endurance_match_source text,
  add column if not exists endurance_match_score numeric;

alter table public.workout_sessions
  drop constraint if exists workout_sessions_endurance_intent_check,
  add constraint workout_sessions_endurance_intent_check check (
    endurance_session_intent is null or endurance_session_intent in ('easy','long','tempo','intervals','recovery','race')
  ),
  drop constraint if exists workout_sessions_endurance_match_source_check,
  add constraint workout_sessions_endurance_match_source_check check (
    endurance_match_source is null or endurance_match_source in ('system_confident','user_confirmed')
  ),
  drop constraint if exists workout_sessions_endurance_match_score_check,
  add constraint workout_sessions_endurance_match_score_check check (
    endurance_match_score is null or endurance_match_score between 0 and 1
  );

comment on column public.workout_sessions.endurance_match_source is
  'Provenance of race-plan session classification. Never infer user_confirmed.';
