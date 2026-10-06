-- Forward hardening for databases that applied earlier Endurance OS migrations.
-- Revoke obsolete client execution privileges even when the original migration
-- has already run. Function bodies are replaced by the canonical definitions
-- in their source migrations on fresh installs.

revoke all on function public.record_endurance_run_import(
  uuid,text,text,text,timestamptz,timestamptz,integer,numeric,integer,numeric,numeric,numeric,jsonb
) from public,anon,authenticated;
grant execute on function public.record_endurance_run_import(
  uuid,text,text,timestamptz,timestamptz,integer,numeric,integer,numeric,numeric,numeric,jsonb
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

revoke all on function public.guard_endurance_match_provenance()
  from public,anon,authenticated,service_role;
revoke all on function public.guard_endurance_race_goal_link()
  from public,anon,authenticated,service_role;
