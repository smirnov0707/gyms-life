-- STAGING ONLY. Synthetic rows; every mutation rolls back.
begin;
select set_config('gyms.backlog_user',gen_random_uuid()::text,true),
       set_config('gyms.backlog_job',gen_random_uuid()::text,true),
       set_config('gyms.backlog_snapshot',gen_random_uuid()::text,true);
insert into auth.users(id,email) values
 (current_setting('gyms.backlog_user')::uuid,current_setting('gyms.backlog_user')||'@example.invalid');
insert into public.background_job_runs(id,job_name,run_key,started_at,window_start,window_end)
 values(current_setting('gyms.backlog_job')::uuid,'night_lab','backlog-'||current_setting('gyms.backlog_job'),now(),now()-interval '7 days',now());
insert into public.athlete_state_snapshots(id,user_id,schema_version,state,state_fingerprint)
 values(current_setting('gyms.backlog_snapshot')::uuid,current_setting('gyms.backlog_user')::uuid,'1.7','{}',repeat('f',64));
set local role service_role;
do $$ declare v_report jsonb; rejected boolean; receipt uuid; begin
 v_report:=jsonb_build_object('version','1.0','runKey','backlog-'||current_setting('gyms.backlog_job'),'reviewOn',(now() at time zone 'Europe/Vilnius')::date,
 'timeZone','Europe/Vilnius','evidenceThrough',now(),'reviewedAt',now(),'status','completed',
 'snapshot',jsonb_build_object('status','confirmed','id',current_setting('gyms.backlog_snapshot')),
 'predictions',jsonb_build_object('status','completed','result',jsonb_build_object('checked',0,'evaluated',0,'independentDays',0,'pending',0,'limited',false)),
 'hypotheses',jsonb_build_object('status','completed','result',jsonb_build_object('current','[]'::jsonb,'transitions','[]'::jsonb)),
 'modelLearning',jsonb_build_object('status','completed','result',jsonb_build_object('state','insufficient_history','evaluatedDays',5,'minimumTrainingDays',12),
 'predictionReview',jsonb_build_object('checked',64,'evaluated',64,'limited',true)),'modelChanged',false,'planChanged',false);
 rejected:=false;
 begin
  perform public.commit_night_lab_review(current_setting('gyms.backlog_job')::uuid,now(),current_setting('gyms.backlog_user')::uuid,v_report);
 exception when raise_exception then rejected:=SQLERRM='NIGHT_REVIEW_STAGE_MISMATCH';
 end;
 if not rejected then raise exception 'Limited backlog was accepted as completed'; end if;
 receipt:=public.commit_night_lab_review(current_setting('gyms.backlog_job')::uuid,now(),current_setting('gyms.backlog_user')::uuid,jsonb_set(v_report,'{status}','"partial"'::jsonb));
 if receipt is null then raise exception 'Partial backlog receipt not stored'; end if;
 if (select r.report#>>'{modelLearning,predictionReview,limited}' from public.night_lab_reviews r where r.id=receipt) is distinct from 'true'
 then raise exception 'Backlog evidence not preserved'; end if;
end $$;
reset role;
select 'passed: limited personal backlog cannot be completed; partial receipt preserves evidence; rollback' as verification;
rollback;
