create or replace function public.record_endurance_run_import(
 p_user_id uuid,p_source text,p_external_activity_id text,p_started_at timestamptz,p_finished_at timestamptz,
 p_duration_seconds integer,p_distance_meters numeric,p_average_hr integer,p_elevation_gain numeric,p_average_cadence numeric,p_split_coverage numeric,p_splits jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_session uuid;v_existing uuid;
begin
 if p_source not in ('apple_health','garmin','strava','device','manual_import') then raise exception 'invalid source';end if;
 if p_duration_seconds <= 0 or p_distance_meters <= 0 or p_split_coverage < 0 or p_split_coverage > 1 then raise exception 'invalid telemetry';end if;
 if auth.role()<>'service_role' then raise exception 'service role required';end if;
 select workout_session_id into v_existing from public.endurance_run_imports where user_id=p_user_id and source=p_source and external_activity_id=p_external_activity_id;
 if v_existing is not null then return v_existing;end if;
 insert into public.workout_sessions(user_id,started_at,finished_at,duration_seconds,title,total_volume,activity_kind,activity_environment,activity_source,distance_meters,average_heart_rate_bpm,elevation_gain_meters,average_cadence_spm)
 values(p_user_id,p_started_at,p_finished_at,p_duration_seconds,'Run',0,'run','outdoor','imported',p_distance_meters,p_average_hr,p_elevation_gain,p_average_cadence) returning id into v_session;
 insert into public.endurance_run_imports(user_id,workout_session_id,source,external_activity_id,split_coverage) values(p_user_id,v_session,p_source,p_external_activity_id,p_split_coverage);
 insert into public.endurance_run_splits(user_id,workout_session_id,split_index,distance_meters,duration_seconds,average_heart_rate_bpm,elevation_gain_meters,cadence_spm)
 select p_user_id,v_session,(x->>'index')::int,(x->>'distanceMeters')::numeric,(x->>'durationSeconds')::numeric,nullif(x->>'averageHeartRateBpm','')::int,nullif(x->>'elevationGainMeters','')::numeric,nullif(x->>'cadenceSpm','')::numeric from jsonb_array_elements(coalesce(p_splits,'[]'::jsonb)) x;
 return v_session;
end$$;
revoke all on function public.record_endurance_run_import(uuid,text,text,timestamptz,timestamptz,integer,numeric,integer,numeric,numeric,numeric,jsonb) from public,anon;
grant execute on function public.record_endurance_run_import(uuid,text,text,timestamptz,timestamptz,integer,numeric,integer,numeric,numeric,numeric,jsonb) to service_role;
