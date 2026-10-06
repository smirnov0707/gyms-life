create or replace function public.replace_active_endurance_race_goal(p_user_id uuid,p_distance text,p_started_on date,p_race_date date,p_target_time_seconds integer,p_sessions_per_week integer,p_baseline_weekly_distance_meters numeric,p_baseline_longest_run_meters numeric)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.role()<>'service_role' then raise exception 'service role required';end if;
 if p_distance not in ('5k','10k','half_marathon','marathon') or p_race_date < p_started_on + 14 or p_sessions_per_week not between 2 and 7 or (p_target_time_seconds is not null and (p_target_time_seconds<=0 or p_target_time_seconds>86400)) or (p_baseline_weekly_distance_meters is not null and p_baseline_weekly_distance_meters<=0) or (p_baseline_longest_run_meters is not null and p_baseline_longest_run_meters<0) then raise exception 'invalid race goal';end if;
 update public.endurance_race_goals set status='cancelled',updated_at=now() where user_id=p_user_id and status='active';
 insert into public.endurance_race_goals(user_id,distance,started_on,race_date,target_time_seconds,sessions_per_week,baseline_weekly_distance_meters,baseline_longest_run_meters) values(p_user_id,p_distance,p_started_on,p_race_date,p_target_time_seconds,p_sessions_per_week,p_baseline_weekly_distance_meters,p_baseline_longest_run_meters) returning id into v_id;
 return v_id;
end$$;
revoke all on function public.replace_active_endurance_race_goal(uuid,text,date,date,integer,integer,numeric,numeric) from public,anon;
grant execute on function public.replace_active_endurance_race_goal(uuid,text,date,integer,integer) to authenticated,service_role;
