-- STAGING ONLY. Synthetic account/history; all mutations roll back.
begin;
select set_config('gyms.pm_user',gen_random_uuid()::text,true),
       set_config('gyms.pm_snapshot',gen_random_uuid()::text,true);
insert into auth.users(id,email)
values(current_setting('gyms.pm_user')::uuid,current_setting('gyms.pm_user')||'@example.invalid');
insert into public.athlete_state_snapshots(id,user_id,schema_version,state,state_fingerprint)
values(current_setting('gyms.pm_snapshot')::uuid,current_setting('gyms.pm_user')::uuid,'1.0','{}',repeat('c',64));
insert into public.decision_records(user_id,athlete_state_snapshot_id,decision_on,engine_version,action,confidence,decision_fingerprint,created_at,prediction)
select current_setting('gyms.pm_user')::uuid,current_setting('gyms.pm_snapshot')::uuid,date '2026-08-01'+g,'1.0','train_as_planned',50,
 md5('first-'||g)||md5('first-x-'||g),(date '2026-08-01'+g)::timestamp+interval '7 hour',
 jsonb_build_object('id',gen_random_uuid(),'target','workout_completion','generatedAt',((date '2026-08-01'+g)::timestamp+interval '8 hour')::timestamptz,
 'horizonEndsAt',((date '2026-08-01'+g)::timestamp+interval '22 hour')::timestamptz,'modelId','workout-completion-usual-day-baseline','modelVersion','0.1.0','maturity','shadow',
 'athleteStateSnapshotId',null,'evidenceLevel','moderate','evidence','[]'::jsonb,'predicted',jsonb_build_object('kind','probability','value',0.5),
 'actual',jsonb_build_object('kind','boolean','value',(g%2=0)),'evaluatedAt',((date '2026-08-01'+g)::timestamp+interval '23 hour')::timestamptz)
from generate_series(0,12) g;
insert into public.decision_records(user_id,athlete_state_snapshot_id,decision_on,engine_version,action,confidence,decision_fingerprint,created_at,prediction)
select current_setting('gyms.pm_user')::uuid,current_setting('gyms.pm_snapshot')::uuid,date '2026-08-01'+g,'1.0','train_as_planned',50,
 md5('late-'||g)||md5('late-x-'||g),(date '2026-08-01'+g)::timestamp+interval '17 hour',
 jsonb_build_object('id',gen_random_uuid(),'target','workout_completion','generatedAt',((date '2026-08-01'+g)::timestamp+interval '18 hour')::timestamptz,
 'horizonEndsAt',((date '2026-08-01'+g)::timestamp+interval '22 hour')::timestamptz,'modelId','workout-completion-usual-day-baseline','modelVersion','0.1.0','maturity','shadow',
 'athleteStateSnapshotId',null,'evidenceLevel','moderate','evidence','[]'::jsonb,'predicted',jsonb_build_object('kind','probability','value',0.9),
 'actual',jsonb_build_object('kind','boolean','value',(g%2=0)),'evaluatedAt',((date '2026-08-01'+g)::timestamp+interval '23 hour')::timestamptz)
from generate_series(0,12) g;
set local role service_role;do $$ declare n integer;bad integer;latest date;earliest date;a uuid:=gen_random_uuid();d uuid;begin
 select count(*),count(*) filter(where prediction#>>'{predicted,value}'<>'0.5'),max(decision_on) into n,bad,latest
 from public.read_personal_completion_training_observations(current_setting('gyms.pm_user')::uuid,date '2026-08-13',365);
 if n<>13 or bad<>0 or latest<>date '2026-08-13' then raise exception 'Unique-day/earliest/cutoff invariant failed';end if;
 select count(*),min(decision_on) into n,earliest
 from public.read_personal_completion_training_observations(current_setting('gyms.pm_user')::uuid,date '2026-08-13',12);
 if n<>12 or earliest<>date '2026-08-02' then raise exception 'Rolling-day limit invariant failed';end if;
 insert into public.personal_model_artifacts(id,user_id,model_id,algorithm_version,source_model_id,source_model_version,status,training_start_on,trained_through,training_days,positive_days,negative_days,evidence_fingerprint,parameters)
 values(a,current_setting('gyms.pm_user')::uuid,'workout-completion-personal-logit-offset','0.1.0','workout-completion-usual-day-baseline','0.1.0','shadow','2026-08-01','2026-08-12',12,6,6,repeat('d',64),'{"kind":"logit_offset_v1","logOddsOffset":0,"ridgePenalty":4}');
 select id into d from public.decision_records where user_id=current_setting('gyms.pm_user')::uuid order by decision_on,created_at limit 1;
 insert into public.personal_model_predictions(id,user_id,artifact_id,decision_id,decision_on,prediction)
 values(gen_random_uuid(),current_setting('gyms.pm_user')::uuid,a,d,'2026-08-01','{}');
 reset role;
 delete from auth.users where id=current_setting('gyms.pm_user')::uuid;
 if exists(select 1 from public.personal_model_artifacts where user_id=current_setting('gyms.pm_user')::uuid)
   or exists(select 1 from public.personal_model_predictions where user_id=current_setting('gyms.pm_user')::uuid)
 then raise exception 'Personal-model owner deletion left rows';end if;
end $$;
set local role authenticated;
do $$ declare rejected boolean:=false;begin
 begin perform * from public.read_personal_completion_training_observations(gen_random_uuid(),current_date,12);
 exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Authenticated client executed training-history RPC';end if;
end $$;
reset role;select 'passed: unique-day window, earliest forecast, cutoff, owner deletion, client denial; rollback' as verification;
rollback;
