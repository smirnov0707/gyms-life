create or replace function public.record_endurance_adaptation_outcome(p_user_id uuid,p_record_id uuid,p_outcome jsonb,p_recorded_at timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_updated integer;
begin
 if auth.role()<>'service_role' and auth.uid() is distinct from p_user_id then raise exception 'not authorized';end if;
 update public.endurance_adaptation_records set outcome=p_outcome,outcome_recorded_at=p_recorded_at where id=p_record_id and user_id=p_user_id and outcome is null;
 get diagnostics v_updated=row_count;return v_updated=1;
end$$;
revoke all on function public.record_endurance_adaptation_outcome(uuid,uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.record_endurance_adaptation_outcome(uuid,uuid,jsonb,timestamptz) to authenticated,service_role;
