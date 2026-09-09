-- STAGING ONLY. No live scheduler/provider invocation. All synthetic rows roll back.
begin;
select set_config('gyms.review_user_a',gen_random_uuid()::text,true),
       set_config('gyms.review_user_b',gen_random_uuid()::text,true),
       set_config('gyms.review_job',gen_random_uuid()::text,true),
       set_config('gyms.review_snapshot',gen_random_uuid()::text,true);
insert into auth.users(id,email) values
 (current_setting('gyms.review_user_a')::uuid,current_setting('gyms.review_user_a')||'@example.invalid'),
 (current_setting('gyms.review_user_b')::uuid,current_setting('gyms.review_user_b')||'@example.invalid');
insert into public.background_job_runs(id,job_name,run_key,started_at,window_start,window_end)
 values(current_setting('gyms.review_job')::uuid,'night_lab','test-'||current_setting('gyms.review_job'),now(),now()-interval '7 days',now());
-- Minimal DB-constraint fixture only; not a validated application athlete model.
insert into public.athlete_state_snapshots(id,user_id,schema_version,state,state_fingerprint)
 values(current_setting('gyms.review_snapshot')::uuid,current_setting('gyms.review_user_a')::uuid,'1.0','{}'::jsonb,repeat('a',64));
set local role service_role;
do $$
declare
 report jsonb;receipt uuid;duplicate uuid;rejected boolean;
 job uuid:=current_setting('gyms.review_job')::uuid;
 a uuid:=current_setting('gyms.review_user_a')::uuid;
 b uuid:=current_setting('gyms.review_user_b')::uuid;
begin
 report:=jsonb_build_object('version','1.0','runKey','test-'||job,
   'reviewOn',(now() at time zone 'Europe/Vilnius')::date,'timeZone','Europe/Vilnius',
   'evidenceThrough',now(),'reviewedAt',now(),'status','completed',
   'snapshot',jsonb_build_object('status','confirmed','id',current_setting('gyms.review_snapshot')),
   'predictions',jsonb_build_object('status','completed','result',jsonb_build_object('checked',0,'evaluated',0,'independentDays',0,'pending',0,'limited',false)),
   'hypotheses',jsonb_build_object('status','completed','result',jsonb_build_object('current','[]'::jsonb,'transitions','[]'::jsonb)),
   'modelChanged',false,'planChanged',false);
 receipt:=public.commit_night_lab_review(job,now(),a,report);
 if receipt is null then raise exception 'Missing receipt';end if;
 duplicate:=public.commit_night_lab_review(job,now(),a,report);
 if receipt<>duplicate or (select count(*) from public.night_lab_reviews where run_id=job and user_id=a)<>1 then raise exception 'Duplicate receipt';end if;
 rejected:=false;
 begin perform public.commit_night_lab_review(job,now(),b,report);
 exception when raise_exception then rejected:=SQLERRM='NIGHT_REVIEW_SNAPSHOT_OWNER';end;
 if not rejected then raise exception 'Cross-owner snapshot accepted';end if;
 rejected:=false;
 begin perform public.commit_night_lab_review(job,now()-interval '1 second',a,report);
 exception when raise_exception then rejected:=SQLERRM='NIGHT_REVIEW_STALE_CLAIM';end;
 if not rejected then raise exception 'Stale worker accepted';end if;
 rejected:=false;
 begin perform public.commit_night_lab_review(job,now(),a,report||'{"modelChanged":true}'::jsonb);
 exception when raise_exception then rejected:=SQLERRM='NIGHT_REVIEW_INVALID_REPORT';end;
 if not rejected then raise exception 'Invented model update accepted';end if;
 rejected:=false;
 begin perform public.commit_night_lab_review(job,now(),a,report||'{"predictions":{"status":"unavailable"}}'::jsonb);
 exception when raise_exception then rejected:=SQLERRM='NIGHT_REVIEW_STAGE_MISMATCH';end;
 if not rejected then raise exception 'Incomplete stage marked completed';end if;
 rejected:=false;
 begin perform public.commit_night_lab_review(job,now(),a,report||jsonb_build_object('reviewedAt',now()+interval '1 day'));
 exception when raise_exception then rejected:=SQLERRM='NIGHT_REVIEW_INVALID_TIME';end;
 if not rejected then raise exception 'Future review accepted';end if;
 perform public.commit_night_lab_review(job,now(),b,report||jsonb_build_object('status','blocked',
   'snapshot',jsonb_build_object('status','blocked','reasons',jsonb_build_array('personalization_consent_required')),
   'predictions',jsonb_build_object('status','not_run'),'hypotheses',jsonb_build_object('status','not_run')));
 if (select count(*) from public.night_lab_reviews where run_id=job)<>2 then raise exception 'Unconfirmed attempts left rows';end if;
 perform set_config('gyms.review_receipt_a',receipt::text,true);
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('gyms.review_user_b'),true);
do $$ declare rejected boolean;begin
 if (select count(*) from public.night_lab_reviews where run_id=current_setting('gyms.review_job')::uuid)<>1 then raise exception 'Wrong user visibility';end if;
 if exists(select 1 from public.night_lab_reviews where id=current_setting('gyms.review_receipt_a')::uuid) then raise exception 'Cross-owner read';end if;
 rejected:=false;
 begin perform public.commit_night_lab_review(current_setting('gyms.review_job')::uuid,now(),current_setting('gyms.review_user_b')::uuid,'{}');
 exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Browser executed report writer';end if;
 if has_table_privilege('authenticated','public.night_lab_reviews','insert')
   or has_table_privilege('authenticated','public.night_lab_reviews','update')
   or has_table_privilege('authenticated','public.night_lab_reviews','delete')
   or has_table_privilege('anon','public.night_lab_reviews','select') then raise exception 'Unexpected report privileges';end if;
end $$;
select 'passed: synthetic receipt persistence, active claim and owner isolation; rolling back' as verification;
rollback;
