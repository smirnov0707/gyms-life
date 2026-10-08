create or replace function public.record_endurance_adaptation(
  p_user_id uuid,
  p_race_goal_id uuid,
  p_decision_on date,
  p_action text,
  p_volume_modifier numeric,
  p_reason text,
  p_evidence jsonb,
  p_engine_version text
)
returns table(
  id uuid,
  action text,
  volume_modifier numeric,
  reason text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fingerprint text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  if p_action not in ('hold','reduce','recover')
     or p_volume_modifier <= 0
     or p_volume_modifier > 1
     or p_reason not in (
       'insufficient_evidence',
       'on_track',
       'repeated_low_response',
       'low_readiness_and_missed_work',
       'repeated_over_target_work'
     )
  then
    raise exception 'invalid adaptation';
  end if;

  if not exists (
    select 1
    from public.endurance_race_goals g
    where g.id = p_race_goal_id
      and g.user_id = p_user_id
  ) then
    raise exception 'race goal ownership mismatch';
  end if;

  v_fingerprint := md5(concat_ws(
        '|',
        p_race_goal_id::text,
        p_decision_on::text,
        p_action,
        p_volume_modifier::text,
        p_reason,
        p_evidence::text,
        p_engine_version
      ));

  return query
  insert into public.endurance_adaptation_records (
    user_id,
    race_goal_id,
    decision_on,
    action,
    volume_modifier,
    reason,
    evidence,
    engine_version,
    decision_fingerprint
  )
  values (
    p_user_id,
    p_race_goal_id,
    p_decision_on,
    p_action,
    p_volume_modifier,
    p_reason,
    p_evidence,
    p_engine_version,
    v_fingerprint
  )
  on conflict (
    user_id,
    race_goal_id,
    decision_on,
    engine_version,
    decision_fingerprint
  ) do nothing
  returning
    endurance_adaptation_records.id,
    endurance_adaptation_records.action,
    endurance_adaptation_records.volume_modifier,
    endurance_adaptation_records.reason,
    endurance_adaptation_records.created_at;
end;
$$;

revoke all on function public.record_endurance_adaptation(
  uuid, uuid, date, text, numeric, text, jsonb, text
) from public, anon, authenticated;

grant execute on function public.record_endurance_adaptation(
  uuid, uuid, date, text, numeric, text, jsonb, text
) to service_role;
