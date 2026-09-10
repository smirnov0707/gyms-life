create function public.read_personal_completion_training_observations(
  p_user_id uuid,
  p_through_on date,
  p_limit_days integer default 365
) returns table(decision_on date,prediction jsonb)
language plpgsql stable security invoker set search_path='' as $$
begin
  if p_through_on is null or p_limit_days<12 or p_limit_days>365 then
    raise exception 'PERSONAL_MODEL_HISTORY_BOUNDARY_INVALID';
  end if;
  return query
  with eligible as (
    select d.id,d.decision_on,d.created_at,d.prediction,
      (d.prediction->>'generatedAt')::timestamptz as generated_at
    from public.decision_records d
    where d.user_id=p_user_id and d.decision_on<=p_through_on
      and d.prediction is not null
      and d.prediction->>'target'='workout_completion'
      and d.prediction->>'modelId'='workout-completion-usual-day-baseline'
      and d.prediction->>'modelVersion'='0.1.0'
      and d.prediction->>'maturity'='shadow'
      and d.prediction#>>'{predicted,kind}'='probability'
      and jsonb_typeof(d.prediction#>'{predicted,value}')='number'
      and d.prediction#>>'{actual,kind}'='boolean'
      and jsonb_typeof(d.prediction#>'{actual,value}')='boolean'
      and d.prediction->>'evaluatedAt' is not null
  ), one_per_day as (
    select distinct on (e.decision_on)
      e.decision_on,e.prediction,e.generated_at,e.created_at,e.id
    from eligible e
    order by e.decision_on desc,e.generated_at asc,e.created_at asc,e.id asc
  )
  select o.decision_on,o.prediction
  from one_per_day o
  order by o.decision_on desc
  limit p_limit_days;
end $$;
revoke all on function public.read_personal_completion_training_observations(uuid,date,integer)
  from public,anon,authenticated;
grant execute on function public.read_personal_completion_training_observations(uuid,date,integer)
  to service_role;
