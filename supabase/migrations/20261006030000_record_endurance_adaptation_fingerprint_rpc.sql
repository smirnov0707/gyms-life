create or replace function public.record_endurance_adaptation(
  p_user_id uuid,
  p_race_goal_id uuid,
  p_decision_on date,
  p_action text,
  p_volume_modifier numeric,
  p_reason text,
  p_evidence jsonb,
  p_engine_version text,
  p_decision_fingerprint text
)
returns table(id uuid,action text,volume_modifier numeric,reason text,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if auth.role()<>'service_role' then raise exception 'service role required';end if;
  if p_action not in ('hold','reduce','recover')
    or p_volume_modifier<=0 or p_volume_modifier>1
    or p_reason not in ('insufficient_evidence','on_track','repeated_low_response','low_readiness_and_missed_work','repeated_over_target_work')
    or p_decision_fingerprint !~ '^[a-f0-9]{64}$'
  then raise exception 'invalid adaptation';end if;
  if not exists(select 1 from public.endurance_race_goals g where g.id=p_race_goal_id and g.user_id=p_user_id)
  then raise exception 'race goal ownership mismatch';end if;

  return query
  insert into public.endurance_adaptation_records(
    user_id,race_goal_id,decision_on,action,volume_modifier,reason,evidence,engine_version,decision_fingerprint
  ) values(
    p_user_id,p_race_goal_id,p_decision_on,p_action,p_volume_modifier,p_reason,p_evidence,p_engine_version,p_decision_fingerprint
  )
  on conflict(user_id,race_goal_id,decision_on,engine_version,decision_fingerprint) do nothing
  returning endurance_adaptation_records.id,endurance_adaptation_records.action,
    endurance_adaptation_records.volume_modifier,endurance_adaptation_records.reason,
    endurance_adaptation_records.created_at;
end$$;

revoke all on function public.record_endurance_adaptation(uuid,uuid,date,text,numeric,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.record_endurance_adaptation(uuid,uuid,date,text,numeric,text,jsonb,text,text) to service_role;
