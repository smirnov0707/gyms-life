create or replace function public.confirm_endurance_race_session_match(
  p_user_id uuid,
  p_workout_session_id uuid,
  p_race_goal_id uuid,
  p_plan_session_key text,
  p_intent text,
  p_match_score numeric
)
returns table(
  id uuid,
  started_at timestamptz,
  endurance_race_goal_id uuid,
  endurance_plan_session_key text,
  endurance_session_intent text,
  endurance_match_source text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  if p_plan_session_key !~ '^w[0-9]+-s[0-9]+$'
     or p_intent not in ('easy','long','tempo','intervals','recovery','race')
     or (p_match_score is not null and (p_match_score < 0 or p_match_score > 1))
  then
    raise exception 'invalid race session match';
  end if;

  if not exists (
    select 1
    from public.endurance_race_goals g
    where g.id = p_race_goal_id
      and g.user_id = p_user_id
      and g.status = 'active'
  ) then
    raise exception 'active race goal ownership mismatch';
  end if;

  return query
  update public.workout_sessions w
  set endurance_race_goal_id = p_race_goal_id,
      endurance_plan_session_key = p_plan_session_key,
      endurance_session_intent = p_intent,
      endurance_match_source = 'user_confirmed',
      endurance_match_score = p_match_score
  where w.id = p_workout_session_id
    and w.user_id = p_user_id
    and w.activity_kind = 'run'
    and w.endurance_match_source is null
  returning
    w.id,
    w.started_at,
    w.endurance_race_goal_id,
    w.endurance_plan_session_key,
    w.endurance_session_intent,
    w.endurance_match_source;
end;
$$;

revoke all on function public.confirm_endurance_race_session_match(
  uuid,uuid,uuid,text,text,numeric
) from public, anon, authenticated;

grant execute on function public.confirm_endurance_race_session_match(
  uuid,uuid,uuid,text,text,numeric
) to service_role;

create or replace function public.guard_endurance_match_provenance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    if new.endurance_match_source = 'system_confident' then
      raise exception 'system_confident provenance is server-owned';
    end if;

    if (
      new.endurance_race_goal_id is distinct from old.endurance_race_goal_id
      or new.endurance_plan_session_key is distinct from old.endurance_plan_session_key
      or new.endurance_session_intent is distinct from old.endurance_session_intent
      or new.endurance_match_source is distinct from old.endurance_match_source
      or new.endurance_match_score is distinct from old.endurance_match_score
    ) then
      raise exception 'endurance match fields require governed confirmation';
    end if;
  end if;

  return new;
end;
$$;
