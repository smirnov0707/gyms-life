create or replace function public.commit_personal_model_prediction(
  p_user_id uuid,p_artifact_id uuid,p_decision_id uuid,p_decision_on date,p_prediction jsonb
) returns uuid
language plpgsql security invoker set search_path='' as $$
declare
  result_id uuid;artifact public.personal_model_artifacts%rowtype;baseline jsonb;
  baseline_p double precision;submitted_p double precision;offset_value double precision;expected_p double precision;
begin
  if p_prediction is null or jsonb_typeof(p_prediction)<>'object' then raise exception 'PERSONAL_MODEL_INVALID_PREDICTION';end if;
  select * into artifact from public.personal_model_artifacts where id=p_artifact_id and user_id=p_user_id and status='shadow';
  if not found then raise exception 'PERSONAL_MODEL_ARTIFACT_UNAVAILABLE';end if;
  if p_decision_on<=artifact.trained_through then raise exception 'PERSONAL_MODEL_TRAINING_LEAK';end if;
  if artifact.parameters->>'kind' is distinct from 'logit_offset_v1'
    or jsonb_typeof(artifact.parameters->'logOddsOffset')<>'number'
    or jsonb_typeof(artifact.parameters->'ridgePenalty')<>'number'
    or (artifact.parameters->>'ridgePenalty')::numeric<>4 then raise exception 'PERSONAL_MODEL_PARAMETERS_INVALID';end if;
  offset_value:=(artifact.parameters->>'logOddsOffset')::double precision;
  if offset_value < -1.5 or offset_value > 1.5 then raise exception 'PERSONAL_MODEL_PARAMETERS_INVALID';end if;
  select prediction into baseline from public.decision_records where id=p_decision_id and user_id=p_user_id and decision_on=p_decision_on;
  if not found or baseline is null then raise exception 'PERSONAL_MODEL_DECISION_UNAVAILABLE';end if;
  if baseline->>'target' is distinct from 'workout_completion' or baseline->>'modelId' is distinct from artifact.source_model_id
    or baseline->>'modelVersion' is distinct from artifact.source_model_version or baseline->>'maturity' is distinct from 'shadow'
    or baseline->'actual' is distinct from 'null'::jsonb or baseline->'evaluatedAt' is distinct from 'null'::jsonb
    or baseline#>>'{predicted,kind}' is distinct from 'probability' or jsonb_typeof(baseline#>'{predicted,value}')<>'number'
  then raise exception 'PERSONAL_MODEL_BASELINE_INELIGIBLE';end if;
  if p_prediction->>'target' is distinct from 'workout_completion' or p_prediction->>'modelId' is distinct from artifact.model_id
    or p_prediction->>'maturity' is distinct from 'shadow'
    or p_prediction->>'modelVersion' is distinct from artifact.algorithm_version||'+'||substring(artifact.id::text from 1 for 8)
    or p_prediction->'actual' is distinct from 'null'::jsonb or p_prediction->'evaluatedAt' is distinct from 'null'::jsonb
    or p_prediction#>>'{predicted,kind}' is distinct from 'probability' or jsonb_typeof(p_prediction#>'{predicted,value}')<>'number'
  then raise exception 'PERSONAL_MODEL_INVALID_PREDICTION';end if;
  if p_prediction->>'generatedAt' is distinct from baseline->>'generatedAt' or p_prediction->>'horizonEndsAt' is distinct from baseline->>'horizonEndsAt'
    or p_prediction->>'athleteStateSnapshotId' is distinct from baseline->>'athleteStateSnapshotId' then raise exception 'PERSONAL_MODEL_BASELINE_PAIR_MISMATCH';end if;
  baseline_p:=least(0.999,greatest(0.001,(baseline#>>'{predicted,value}')::double precision));
  submitted_p:=(p_prediction#>>'{predicted,value}')::double precision;
  expected_p:=least(0.999,greatest(0.001,1.0/(1.0+exp(-(ln(baseline_p/(1.0-baseline_p))+offset_value)))));
  expected_p:=round(expected_p::numeric,6)::double precision;
  if submitted_p<=0 or submitted_p>=1 or abs(submitted_p-expected_p)>0.000001
    or (p_prediction->>'generatedAt')::timestamptz >= (p_prediction->>'horizonEndsAt')::timestamptz
  then raise exception 'PERSONAL_MODEL_PREDICTION_VALUE_MISMATCH';end if;
  result_id:=(p_prediction->>'id')::uuid;if result_id is null then raise exception 'PERSONAL_MODEL_INVALID_PREDICTION';end if;
  insert into public.personal_model_predictions(id,user_id,artifact_id,decision_id,decision_on,prediction)
    values(result_id,p_user_id,p_artifact_id,p_decision_id,p_decision_on,p_prediction)
    on conflict(user_id,artifact_id,decision_id) do nothing returning id into result_id;
  if result_id is null then select id into result_id from public.personal_model_predictions where user_id=p_user_id and artifact_id=p_artifact_id and decision_id=p_decision_id;end if;
  return result_id;
end $$;
revoke all on function public.commit_personal_model_prediction(uuid,uuid,uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.commit_personal_model_prediction(uuid,uuid,uuid,date,jsonb) to service_role;
