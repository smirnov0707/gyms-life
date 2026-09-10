-- STAGING ONLY. Synthetic owner/model rows; all mutations roll back.
begin;
select set_config('gyms.rotate_user',gen_random_uuid()::text,true),set_config('gyms.rotate_old',gen_random_uuid()::text,true),set_config('gyms.rotate_new',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('gyms.rotate_user')::uuid,current_setting('gyms.rotate_user')||'@example.invalid');
set local role service_role;
insert into public.personal_model_artifacts(id,user_id,model_id,algorithm_version,source_model_id,source_model_version,status,training_start_on,trained_through,training_days,positive_days,negative_days,evidence_fingerprint,parameters)
values(current_setting('gyms.rotate_old')::uuid,current_setting('gyms.rotate_user')::uuid,'workout-completion-personal-logit-offset','0.1.0','workout-completion-usual-day-baseline','0.1.0','shadow',current_date-365,current_date-30,365,250,115,repeat('a',64),'{"kind":"logit_offset_v1","logOddsOffset":0.1,"ridgePenalty":4}');
do $$ declare artifact jsonb;rejected boolean;rid uuid;begin
 artifact:=jsonb_build_object('id',current_setting('gyms.rotate_new'),'modelId','workout-completion-personal-logit-offset','algorithmVersion','0.1.0','sourceModelId','workout-completion-usual-day-baseline','sourceModelVersion','0.1.0','trainingStartOn',(current_date-364)::text,'trainedThrough',(current_date-1)::text,'trainingDays',365,'positiveDays',248,'negativeDays',117,'evidenceFingerprint',repeat('b',64),'parameters',jsonb_build_object('kind','logit_offset_v1','logOddsOffset',0.05,'ridgePenalty',4));
 rejected:=false;begin perform public.rotate_personal_completion_artifact(current_setting('gyms.rotate_user')::uuid,current_setting('gyms.rotate_old')::uuid,artifact||jsonb_build_object('trainedThrough',(current_date-31)::text));exception when raise_exception then rejected:=SQLERRM='PERSONAL_MODEL_ROTATION_INVALID';end;if not rejected then raise exception 'Older replacement accepted';end if;
 rejected:=false;begin perform public.rotate_personal_completion_artifact(current_setting('gyms.rotate_user')::uuid,current_setting('gyms.rotate_old')::uuid,artifact||jsonb_build_object('evidenceFingerprint',repeat('a',64)));exception when raise_exception then rejected:=SQLERRM='PERSONAL_MODEL_ROTATION_INVALID';end;if not rejected then raise exception 'Identical evidence accepted';end if;
 rid:=public.rotate_personal_completion_artifact(current_setting('gyms.rotate_user')::uuid,current_setting('gyms.rotate_old')::uuid,artifact);if rid<>current_setting('gyms.rotate_new')::uuid then raise exception 'Replacement identity mismatch';end if;
 if (select status from public.personal_model_artifacts where id=current_setting('gyms.rotate_old')::uuid)<>'retired' or (select status from public.personal_model_artifacts where id=rid)<>'shadow' then raise exception 'Atomic statuses wrong';end if;
 if (select count(*) from public.personal_model_artifacts where user_id=current_setting('gyms.rotate_user')::uuid and status in ('shadow','qualified'))<>1 then raise exception 'Active uniqueness lost';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('gyms.rotate_user'),true);
do $$ declare rejected boolean;begin rejected:=false;begin perform public.rotate_personal_completion_artifact(current_setting('gyms.rotate_user')::uuid,current_setting('gyms.rotate_new')::uuid,'{}');exception when insufficient_privilege then rejected:=true;end;if not rejected then raise exception 'Browser rotation RPC allowed';end if;end $$;
reset role;
select 'passed: rolling-window replacement, atomic retirement, active uniqueness, browser denial; rollback' as verification;
rollback;
