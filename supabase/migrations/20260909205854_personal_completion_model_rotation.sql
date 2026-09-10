-- Strengthen owner relationships for personal-model shadow records.
alter table public.personal_model_artifacts
  add constraint personal_model_artifacts_id_user_unique unique(id,user_id);
alter table public.decision_records
  add constraint decision_records_id_user_unique unique(id,user_id);
alter table public.personal_model_predictions
  add constraint personal_model_predictions_artifact_owner_fkey
  foreign key(artifact_id,user_id)
  references public.personal_model_artifacts(id,user_id) on delete restrict;
alter table public.personal_model_predictions
  add constraint personal_model_predictions_decision_owner_fkey
  foreign key(decision_id,user_id)
  references public.decision_records(id,user_id) on delete cascade;

create function public.qualify_personal_completion_artifact(
  p_user_id uuid,
  p_artifact_id uuid,
  p_qualification jsonb
) returns boolean
language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
  if p_qualification is null or jsonb_typeof(p_qualification)<>'object' then
    raise exception 'PERSONAL_MODEL_QUALIFICATION_INVALID';
  end if;
  if coalesce((p_qualification->>'promotionEligible')::boolean,false) is not true
    or coalesce((p_qualification->>'pairedDays')::integer,0)<20
    or coalesce((p_qualification->>'positiveDays')::integer,0)<2
    or coalesce((p_qualification->>'negativeDays')::integer,0)<2 then
    raise exception 'PERSONAL_MODEL_QUALIFICATION_INVALID';
  end if;
  if coalesce((p_qualification->>'improvementCi95Low')::numeric,0)<=0
    or p_qualification->>'baselineBrier' is null
    or p_qualification->>'challengerBrier' is null
    or p_qualification->>'baselineLogLoss' is null
    or p_qualification->>'challengerLogLoss' is null then
    raise exception 'PERSONAL_MODEL_QUALIFICATION_INVALID';
  end if;
  if (p_qualification->>'challengerBrier')::numeric >=
     (p_qualification->>'baselineBrier')::numeric
    or (p_qualification->>'challengerLogLoss')::numeric >=
       (p_qualification->>'baselineLogLoss')::numeric then
    raise exception 'PERSONAL_MODEL_QUALIFICATION_INVALID';
  end if;
  update public.personal_model_artifacts
    set status='qualified',qualification=p_qualification
    where id=p_artifact_id and user_id=p_user_id and status='shadow';
  get diagnostics changed=row_count;
  return changed=1;
end $$;
revoke all on function public.qualify_personal_completion_artifact(uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.qualify_personal_completion_artifact(uuid,uuid,jsonb)
  to service_role;

create function public.rotate_personal_completion_artifact(
  p_user_id uuid,
  p_previous_artifact_id uuid,
  p_artifact jsonb
) returns uuid
language plpgsql security invoker set search_path='' as $$
declare previous public.personal_model_artifacts%rowtype;new_id uuid;
begin
  if p_artifact is null or jsonb_typeof(p_artifact)<>'object' then
    raise exception 'PERSONAL_MODEL_ROTATION_INVALID';
  end if;
  select * into previous from public.personal_model_artifacts
    where id=p_previous_artifact_id and user_id=p_user_id and status='shadow'
    for update;
  if not found then raise exception 'PERSONAL_MODEL_PREVIOUS_UNAVAILABLE';end if;
  new_id:=(p_artifact->>'id')::uuid;
  if new_id is null or new_id=p_previous_artifact_id
    or p_artifact->>'modelId' is distinct from previous.model_id
    or p_artifact->>'algorithmVersion' is distinct from previous.algorithm_version
    or p_artifact->>'sourceModelId' is distinct from previous.source_model_id
    or p_artifact->>'sourceModelVersion' is distinct from previous.source_model_version
    or (p_artifact->>'trainedThrough')::date<=previous.trained_through
    or (p_artifact->>'trainingDays')::integer<=previous.training_days then
    raise exception 'PERSONAL_MODEL_ROTATION_INVALID';
  end if;
  update public.personal_model_artifacts
    set status='retired',retired_at=clock_timestamp()
    where id=previous.id and user_id=p_user_id and status='shadow';
  insert into public.personal_model_artifacts(
    id,user_id,model_id,algorithm_version,source_model_id,source_model_version,status,
    training_start_on,trained_through,training_days,positive_days,negative_days,
    evidence_fingerprint,parameters
  ) values(
    new_id,p_user_id,p_artifact->>'modelId',p_artifact->>'algorithmVersion',
    p_artifact->>'sourceModelId',p_artifact->>'sourceModelVersion','shadow',
    (p_artifact->>'trainingStartOn')::date,(p_artifact->>'trainedThrough')::date,
    (p_artifact->>'trainingDays')::integer,(p_artifact->>'positiveDays')::integer,
    (p_artifact->>'negativeDays')::integer,p_artifact->>'evidenceFingerprint',
    p_artifact->'parameters'
  );
  return new_id;
end $$;
revoke all on function public.rotate_personal_completion_artifact(uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.rotate_personal_completion_artifact(uuid,uuid,jsonb)
  to service_role;
