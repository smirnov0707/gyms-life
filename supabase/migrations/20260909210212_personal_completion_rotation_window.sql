create or replace function public.rotate_personal_completion_artifact(
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
    or p_artifact->>'evidenceFingerprint'=previous.evidence_fingerprint then
    raise exception 'PERSONAL_MODEL_ROTATION_INVALID';
  end if;
  update public.personal_model_artifacts set status='retired',retired_at=clock_timestamp()
    where id=previous.id and user_id=p_user_id and status='shadow';
  insert into public.personal_model_artifacts(
    id,user_id,model_id,algorithm_version,source_model_id,source_model_version,status,
    training_start_on,trained_through,training_days,positive_days,negative_days,evidence_fingerprint,parameters
  ) values(
    new_id,p_user_id,p_artifact->>'modelId',p_artifact->>'algorithmVersion',p_artifact->>'sourceModelId',p_artifact->>'sourceModelVersion','shadow',
    (p_artifact->>'trainingStartOn')::date,(p_artifact->>'trainedThrough')::date,(p_artifact->>'trainingDays')::integer,
    (p_artifact->>'positiveDays')::integer,(p_artifact->>'negativeDays')::integer,p_artifact->>'evidenceFingerprint',p_artifact->'parameters');
  return new_id;
end $$;
revoke all on function public.rotate_personal_completion_artifact(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.rotate_personal_completion_artifact(uuid,uuid,jsonb) to service_role;
