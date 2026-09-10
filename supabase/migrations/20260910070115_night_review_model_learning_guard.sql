create or replace function public.commit_night_lab_review(p_run_id uuid,p_claimed_at timestamptz,p_user_id uuid,p_report jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare job public.background_job_runs%rowtype; result_id uuid; v_zone text; v_snapshot uuid; v_evidence_at timestamptz; v_reviewed_at timestamptz; v_report_day date;
begin
 if p_report is null or jsonb_typeof(p_report)<>'object' or octet_length(p_report::text)>100000
   or p_report->>'version' is distinct from '1.0' or coalesce(p_report->>'status','') not in ('completed','partial','blocked')
   or p_report->'modelChanged' is distinct from 'false'::jsonb or p_report->'planChanged' is distinct from 'false'::jsonb
 then raise exception 'NIGHT_REVIEW_INVALID_REPORT';end if;
 select * into job from public.background_job_runs where id=p_run_id for update;
 if not found or job.job_name<>'night_lab' or job.status<>'running' or job.started_at<>p_claimed_at
   or p_claimed_at is null or clock_timestamp()>job.started_at+interval '30 minutes'
 then raise exception 'NIGHT_REVIEW_STALE_CLAIM';end if;
 if p_report->>'runKey' is distinct from job.run_key then raise exception 'NIGHT_REVIEW_RUN_MISMATCH';end if;
 v_zone:=p_report->>'timeZone';
 if not exists(select 1 from pg_timezone_names where name=v_zone) then raise exception 'NIGHT_REVIEW_INVALID_ZONE';end if;
 v_evidence_at:=(p_report->>'evidenceThrough')::timestamptz;
 v_reviewed_at:=(p_report->>'reviewedAt')::timestamptz;
 v_report_day:=(p_report->>'reviewOn')::date;
 if v_evidence_at is null or v_reviewed_at is null or v_report_day is null or not isfinite(v_evidence_at) or not isfinite(v_reviewed_at)
   or v_evidence_at<>job.window_end or v_reviewed_at<v_evidence_at or v_reviewed_at>clock_timestamp()+interval '5 minutes'
   or v_report_day<>(v_evidence_at at time zone v_zone)::date
 then raise exception 'NIGHT_REVIEW_INVALID_TIME';end if;
 if p_report#>>'{snapshot,status}'='confirmed' then
   v_snapshot:=(p_report#>>'{snapshot,id}')::uuid;
   if v_snapshot is null or not exists(select 1 from public.athlete_state_snapshots where id=v_snapshot and user_id=p_user_id)
     then raise exception 'NIGHT_REVIEW_SNAPSHOT_OWNER';end if;
   if p_report->>'status'='blocked' then raise exception 'NIGHT_REVIEW_STAGE_MISMATCH';end if;
 else
   if coalesce(p_report#>>'{snapshot,status}','') not in ('blocked','unavailable') or p_report->>'status'<>'blocked'
     or p_report#>>'{predictions,status}' is distinct from 'not_run' or p_report#>>'{hypotheses,status}' is distinct from 'not_run'
     or (p_report ? 'modelLearning' and p_report#>>'{modelLearning,status}' is distinct from 'not_run')
   then raise exception 'NIGHT_REVIEW_STAGE_MISMATCH';end if;
 end if;
 if p_report ? 'modelLearning' and coalesce(p_report#>>'{modelLearning,status}','') not in ('completed','unavailable','not_run') then raise exception 'NIGHT_REVIEW_STAGE_MISMATCH';end if;
 if p_report->>'status'='completed' and (p_report#>>'{predictions,status}' is distinct from 'completed' or p_report#>>'{hypotheses,status}' is distinct from 'completed' or (p_report ? 'modelLearning' and p_report#>>'{modelLearning,status}' is distinct from 'completed'))
   then raise exception 'NIGHT_REVIEW_STAGE_MISMATCH';end if;
 insert into public.night_lab_reviews(run_id,user_id,run_key,review_on,time_zone,reviewed_at,snapshot_id,report)
 values(p_run_id,p_user_id,job.run_key,v_report_day,v_zone,v_reviewed_at,v_snapshot,p_report)
 on conflict(run_id,user_id) do nothing returning id into result_id;
 if result_id is null then select id into result_id from public.night_lab_reviews where run_id=p_run_id and user_id=p_user_id;end if;
 return result_id;
end $$;
revoke all on function public.commit_night_lab_review(uuid,timestamptz,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.commit_night_lab_review(uuid,timestamptz,uuid,jsonb) to service_role;
