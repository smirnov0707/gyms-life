revoke all on function public.record_endurance_run_import(
  uuid,text,text,text,timestamptz,timestamptz,integer,numeric,integer,numeric,numeric,numeric,jsonb
) from public,anon,authenticated;
grant execute on function public.record_endurance_run_import(
  uuid,text,text,text,timestamptz,timestamptz,integer,numeric,integer,numeric,numeric,numeric,jsonb
) to service_role;

revoke all on function public.replace_active_endurance_race_goal(
  uuid,text,date,date,integer,integer,numeric,numeric
) from public,anon,authenticated;
grant execute on function public.replace_active_endurance_race_goal(
  uuid,text,date,date,integer,integer,numeric,numeric
) to service_role;

revoke all on function public.record_endurance_adaptation(
  uuid,uuid,date,text,numeric,text,jsonb,text,text
) from public,anon,authenticated;
grant execute on function public.record_endurance_adaptation(
  uuid,uuid,date,text,numeric,text,jsonb,text,text
) to service_role;

revoke all on function public.record_endurance_adaptation_outcome(
  uuid,uuid,jsonb,timestamptz
) from public,anon,authenticated;
grant execute on function public.record_endurance_adaptation_outcome(
  uuid,uuid,jsonb,timestamptz
) to service_role;
