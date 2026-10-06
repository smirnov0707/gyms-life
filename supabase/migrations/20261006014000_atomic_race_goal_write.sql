create or replace function public.replace_active_endurance_race_goal(p_user_id uuid,p_distance text,p_race_date date,p_target_time_seconds integer,p_sessions_per_week integer,p_baseline_weekly_distance_meters numeric,p_baseline_longest_run_meters numeric)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.role()<>'service_role' and auth.uid() is distinct from p_user_id then raise exception 'not authorized';end if;
 if p_distance not in ('5k','10k','half_marathon','marathon') or p_race_date<=current_date or p_sessions_per_week not between 2 and 7 or (p_target_time_seconds is not null and p_target_time_seconds<=0) then raise exception 'invalid race goal';end if;
 update public.endurance_race_goals set status='cancelled',updated_at=now() where user_id=p_user_id and status='active';
 insert into public.endurance_race_goals(user_id,distance,race_date,target_time_seconds,sessions_per_week,baseline_weekly_distance_meters,baseline_longest_run_meters) values(p_user_id,p_distance,p_race_date,p_target_time_seconds,p_sessions_per_week,p_baseline_weekly_distance_meters,p_baseline_longest_run_meters) returning id into v_id;
 return v_id;
end$$;
revoke all on function public.replace_active_endurance_race_goal(uuid,text,date,integer,integer,numeric,numeric) from public,anon;
grant execute on function public.replace_active_endurance_race_goal(uuid,text,date,integer,integer) to authenticated,service_role;
