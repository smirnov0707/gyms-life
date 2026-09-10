-- STAGING ONLY. Synthetic users/model rows; all mutations roll back.
begin;
select set_config('gyms.qa_user',gen_random_uuid()::text,true),
       set_config('gyms.pair_user',gen_random_uuid()::text,true),
       set_config('gyms.qa_snapshot',gen_random_uuid()::text,true),
       set_config('gyms.pair_snapshot',gen_random_uuid()::text,true),
       set_config('gyms.qa_artifact',gen_random_uuid()::text,true),
       set_config('gyms.pair_artifact',gen_random_uuid()::text,true);
insert into auth.users(id,email) values
 (current_setting('gyms.qa_user')::uuid,current_setting('gyms.qa_user')||'@example.invalid'),
 (current_setting('gyms.pair_user')::uuid,current_setting('gyms.pair_user')||'@example.invalid');
insert into public.athlete_state_snapshots(id,user_id,schema_version,state,state_fingerprint) values
 (current_setting('gyms.qa_snapshot')::uuid,current_setting('gyms.qa_user')::uuid,'1.7','{}',repeat('a',64)),
 (current_setting('gyms.pair_snapshot')::uuid,current_setting('gyms.pair_user')::uuid,'1.7','{}',repeat('b',64));
set local role service_role;
insert into public.personal_model_artifacts(id,user_id,model_id,algorithm_version,source_model_id,source_model_version,status,training_start_on,trained_through,training_days,positive_days,negative_days,evidence_fingerprint,parameters) values
 (current_setting('gyms.qa_artifact')::uuid,current_setting('gyms.qa_user')::uuid,'workout-completion-personal-logit-offset','0.1.0','workout-completion-usual-day-baseline','0.1.0','shadow',current_date-40,current_date-21,20,16,4,repeat('c',64),'{"kind":"logit_offset_v1","logOddsOffset":1.0,"ridgePenalty":4}'),
 (current_setting('gyms.pair_artifact')::uuid,current_setting('gyms.pair_user')::uuid,'workout-completion-personal-logit-offset','0.1.0','workout-completion-usual-day-baseline','0.1.0','shadow',current_date-30,current_date-5,12,7,5,repeat('d',64),'{"kind":"logit_offset_v1","logOddsOffset":-0.1,"ridgePenalty":4}');
create temporary table tmp_holdout as
select i,current_date-21+i as day,gen_random_uuid() as decision_id,gen_random_uuid() as baseline_id,gen_random_uuid() as challenger_id,(i<=16) as actual
from generate_series(1,21) i;
insert into public.decision_records(id,user_id,athlete_state_snapshot_id,decision_on,engine_version,decision_fingerprint,action,decision_basis,prediction)
select decision_id,current_setting('gyms.qa_user')::uuid,current_setting('gyms.qa_snapshot')::uuid,day,'1.0',repeat(lpad(i::text,2,'0'),32),'train_as_planned','observed_pattern',
 jsonb_build_object('id',baseline_id,'target','workout_completion','generatedAt',(day::timestamp+time '08:00') at time zone 'UTC','horizonEndsAt',(day::timestamp+time '23:00') at time zone 'UTC','modelId','workout-completion-usual-day-baseline','modelVersion','0.1.0','maturity','shadow','athleteStateSnapshotId',current_setting('gyms.qa_snapshot'),'evidenceLevel','moderate','evidence','[]'::jsonb,'predicted',jsonb_build_object('kind','probability','value',0.5),'actual',jsonb_build_object('kind','boolean','value',actual),'evaluatedAt',(day::timestamp+time '20:00') at time zone 'UTC')
from tmp_holdout;
insert into public.personal_model_predictions(id,user_id,artifact_id,decision_id,decision_on,prediction)
select challenger_id,current_setting('gyms.qa_user')::uuid,current_setting('gyms.qa_artifact')::uuid,decision_id,day,
 jsonb_build_object('id',challenger_id,'target','workout_completion','generatedAt',(day::timestamp+time '08:00') at time zone 'UTC','horizonEndsAt',(day::timestamp+time '23:00') at time zone 'UTC','modelId','workout-completion-personal-logit-offset','modelVersion','0.1.0+'||substring(current_setting('gyms.qa_artifact') from 1 for 8),'maturity','shadow','athleteStateSnapshotId',current_setting('gyms.qa_snapshot'),'evidenceLevel','moderate','evidence','[]'::jsonb,'predicted',jsonb_build_object('kind','probability','value',0.731059),'actual',jsonb_build_object('kind','boolean','value',actual),'evaluatedAt',(day::timestamp+time '20:00') at time zone 'UTC')
from tmp_holdout;
do $$ declare q jsonb;rejected boolean;ok boolean;begin
 q:=jsonb_build_object('promotionEligible',true,'pairedDays',20,'positiveDays',16,'negativeDays',4,'minimumHoldoutDays',20,'baselineBrier',0.25,'challengerBrier',0.164753,'meanBrierImprovement',0.085247,'improvementCi95Low',0.002130,'baselineLogLoss',0.693147,'challengerLogLoss',0.513262,'baselineCalibrationGap',0.3,'challengerCalibrationGap',0.068941,'evaluatedAt',now());
 rejected:=false;begin perform public.qualify_personal_completion_artifact(current_setting('gyms.qa_user')::uuid,current_setting('gyms.qa_artifact')::uuid,q||'{"challengerBrier":0.01}'::jsonb);exception when raise_exception then rejected:=SQLERRM='PERSONAL_MODEL_QUALIFICATION_EVIDENCE_MISMATCH';end;if not rejected then raise exception 'Forged metric accepted';end if;
 ok:=public.qualify_personal_completion_artifact(current_setting('gyms.qa_user')::uuid,current_setting('gyms.qa_artifact')::uuid,q);if not ok then raise exception 'Exact DB evidence did not qualify';end if;
 if (select status from public.personal_model_artifacts where id=current_setting('gyms.qa_artifact')::uuid)<>'qualified' then raise exception 'Qualified state not stored';end if;
end $$;
create temporary table tmp_pair as select gen_random_uuid() decision_id,gen_random_uuid() baseline_id,gen_random_uuid() challenger_id;
insert into public.decision_records(id,user_id,athlete_state_snapshot_id,decision_on,engine_version,decision_fingerprint,action,decision_basis,prediction)
select decision_id,current_setting('gyms.pair_user')::uuid,current_setting('gyms.pair_snapshot')::uuid,current_date,'1.0',repeat('e',64),'train_as_planned','observed_pattern',jsonb_build_object('id',baseline_id,'target','workout_completion','generatedAt',now(),'horizonEndsAt',now()+interval '12 hours','modelId','workout-completion-usual-day-baseline','modelVersion','0.1.0','maturity','shadow','athleteStateSnapshotId',current_setting('gyms.pair_snapshot'),'evidenceLevel','moderate','evidence','[]'::jsonb,'predicted',jsonb_build_object('kind','probability','value',0.5),'actual',null,'evaluatedAt',null) from tmp_pair;
do $$ declare payload jsonb;rid uuid;rejected boolean;begin
 select jsonb_build_object('id',challenger_id,'target','workout_completion','generatedAt',d.prediction->>'generatedAt','horizonEndsAt',d.prediction->>'horizonEndsAt','modelId','workout-completion-personal-logit-offset','modelVersion','0.1.0+'||substring(current_setting('gyms.pair_artifact') from 1 for 8),'maturity','shadow','athleteStateSnapshotId',current_setting('gyms.pair_snapshot'),'evidenceLevel','moderate','evidence','[]'::jsonb,'predicted',jsonb_build_object('kind','probability','value',0.475021),'actual',null,'evaluatedAt',null) into payload from tmp_pair t join public.decision_records d on d.id=t.decision_id;
 rejected:=false;begin perform public.commit_personal_model_prediction(current_setting('gyms.pair_user')::uuid,current_setting('gyms.pair_artifact')::uuid,(select decision_id from tmp_pair),current_date,payload||jsonb_build_object('generatedAt',now()-interval '1 minute'));exception when raise_exception then rejected:=SQLERRM='PERSONAL_MODEL_BASELINE_PAIR_MISMATCH';end;if not rejected then raise exception 'Mismatched pair accepted';end if;
 rejected:=false;begin perform public.commit_personal_model_prediction(current_setting('gyms.pair_user')::uuid,current_setting('gyms.pair_artifact')::uuid,(select decision_id from tmp_pair),current_date,jsonb_set(payload,'{predicted,value}','0.55'::jsonb));exception when raise_exception then rejected:=SQLERRM='PERSONAL_MODEL_PREDICTION_VALUE_MISMATCH';end;if not rejected then raise exception 'Forged challenger probability accepted';end if;
 rid:=public.commit_personal_model_prediction(current_setting('gyms.pair_user')::uuid,current_setting('gyms.pair_artifact')::uuid,(select decision_id from tmp_pair),current_date,payload);if rid<>(select challenger_id from tmp_pair) then raise exception 'Exact pair not stored';end if;
 if public.commit_personal_model_prediction(current_setting('gyms.pair_user')::uuid,current_setting('gyms.pair_artifact')::uuid,(select decision_id from tmp_pair),current_date,payload)<>rid then raise exception 'Retry was not idempotent';end if;
 update public.personal_model_artifacts set status='qualified' where id=current_setting('gyms.pair_artifact')::uuid;
 rejected:=false;begin perform public.commit_personal_model_prediction(current_setting('gyms.pair_user')::uuid,current_setting('gyms.pair_artifact')::uuid,(select decision_id from tmp_pair),current_date,payload);exception when raise_exception then rejected:=SQLERRM='PERSONAL_MODEL_ARTIFACT_UNAVAILABLE';end;if not rejected then raise exception 'Qualified artifact emitted another challenger';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('gyms.qa_user'),true);
do $$ declare rejected boolean;begin
 if exists(select 1 from public.personal_model_artifacts where user_id=current_setting('gyms.pair_user')::uuid) then raise exception 'Cross-owner artifact visible';end if;
 rejected:=false;begin perform public.qualify_personal_completion_artifact(current_setting('gyms.qa_user')::uuid,current_setting('gyms.qa_artifact')::uuid,'{}');exception when insufficient_privilege then rejected:=true;end;if not rejected then raise exception 'Browser qualification allowed';end if;
end $$;
reset role;
select 'passed: exact forward evidence qualification, strict baseline pairing, frozen qualified model, owner isolation; rollback' as verification;
rollback;
