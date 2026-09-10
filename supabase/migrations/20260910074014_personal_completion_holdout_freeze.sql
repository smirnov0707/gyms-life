create or replace function public.qualify_personal_completion_artifact(
  p_user_id uuid,p_artifact_id uuid,p_qualification jsonb
) returns boolean
language plpgsql security invoker set search_path='' as $$
declare
  artifact public.personal_model_artifacts%rowtype;offset_value double precision;
  paired_days integer;positive_days integer;negative_days integer;
  baseline_brier double precision;challenger_brier double precision;mean_improvement double precision;ci_low double precision;
  baseline_logloss double precision;challenger_logloss double precision;baseline_gap double precision;challenger_gap double precision;
  latest_evidence timestamptz;qualification_at timestamptz;changed integer;
begin
  if p_qualification is null or jsonb_typeof(p_qualification)<>'object'
    or coalesce((p_qualification->>'promotionEligible')::boolean,false) is not true
    or coalesce((p_qualification->>'minimumHoldoutDays')::integer,0)<>20 then raise exception 'PERSONAL_MODEL_QUALIFICATION_INVALID';end if;
  select * into artifact from public.personal_model_artifacts where id=p_artifact_id and user_id=p_user_id and status='shadow' for update;
  if not found then return false;end if;
  if artifact.parameters->>'kind' is distinct from 'logit_offset_v1'
    or jsonb_typeof(artifact.parameters->'logOddsOffset')<>'number'
    or jsonb_typeof(artifact.parameters->'ridgePenalty')<>'number'
    or (artifact.parameters->>'ridgePenalty')::numeric<>4 then raise exception 'PERSONAL_MODEL_PARAMETERS_INVALID';end if;
  offset_value:=(artifact.parameters->>'logOddsOffset')::double precision;
  if offset_value < -1.5 or offset_value > 1.5 then raise exception 'PERSONAL_MODEL_PARAMETERS_INVALID';end if;
  qualification_at:=(p_qualification->>'evaluatedAt')::timestamptz;
  with paired as (
    select distinct on (p.decision_on)
      p.decision_on,(p.prediction#>>'{actual,value}')::boolean as actual,
      probs.baseline_p,probs.challenger_p,
      greatest((p.prediction->>'evaluatedAt')::timestamptz,(d.prediction->>'evaluatedAt')::timestamptz) as evidence_at
    from public.personal_model_predictions p
    join public.decision_records d on d.id=p.decision_id and d.user_id=p.user_id and d.decision_on=p.decision_on
    cross join lateral (select
      least(0.999,greatest(0.001,(d.prediction#>>'{predicted,value}')::double precision)) as baseline_p,
      least(0.999,greatest(0.001,(p.prediction#>>'{predicted,value}')::double precision)) as challenger_p
    ) probs
    where p.user_id=p_user_id and p.artifact_id=p_artifact_id and p.decision_on>artifact.trained_through
      and p.prediction#>>'{target}'='workout_completion' and p.prediction#>>'{modelId}'=artifact.model_id
      and p.prediction#>>'{modelVersion}'=artifact.algorithm_version||'+'||substring(artifact.id::text from 1 for 8)
      and p.prediction#>>'{maturity}'='shadow' and p.prediction#>>'{actual,kind}'='boolean' and p.prediction->>'evaluatedAt' is not null
      and d.prediction#>>'{target}'='workout_completion' and d.prediction#>>'{modelId}'=artifact.source_model_id
      and d.prediction#>>'{modelVersion}'=artifact.source_model_version and d.prediction#>>'{maturity}'='shadow'
      and d.prediction#>>'{actual,kind}'='boolean' and d.prediction->>'evaluatedAt' is not null
      and p.prediction#>>'{actual,value}'=d.prediction#>>'{actual,value}'
      and p.prediction->>'generatedAt'=d.prediction->>'generatedAt' and p.prediction->>'horizonEndsAt'=d.prediction->>'horizonEndsAt'
      and p.prediction->>'athleteStateSnapshotId'=d.prediction->>'athleteStateSnapshotId'
      and p.prediction#>>'{predicted,kind}'='probability' and d.prediction#>>'{predicted,kind}'='probability'
      and abs(probs.challenger_p-round(least(0.999,greatest(0.001,1.0/(1.0+exp(-(ln(probs.baseline_p/(1.0-probs.baseline_p))+offset_value)))))::numeric,6)::double precision)<=0.000001
    order by p.decision_on,p.created_at,p.id
  ), frozen_holdout as (
    select * from paired order by decision_on limit 20
  ), scored as (
    select actual,baseline_p,challenger_p,evidence_at,
      power(baseline_p-(case when actual then 1.0 else 0.0 end),2) as baseline_error,
      power(challenger_p-(case when actual then 1.0 else 0.0 end),2) as challenger_error,
      -(case when actual then ln(baseline_p) else ln(1-baseline_p) end) as baseline_ll,
      -(case when actual then ln(challenger_p) else ln(1-challenger_p) end) as challenger_ll from frozen_holdout
  ), stats as (
    select count(*)::integer n,count(*) filter(where actual)::integer positives,count(*) filter(where not actual)::integer negatives,
      avg(baseline_error) bb,avg(challenger_error) cb,avg(baseline_error-challenger_error) improvement,
      avg(baseline_error-challenger_error)-1.96*coalesce(stddev_samp(baseline_error-challenger_error),0)/sqrt(greatest(count(*),1)) lower,
      avg(baseline_ll) bll,avg(challenger_ll) cll,
      abs(avg(baseline_p)-avg(case when actual then 1.0 else 0.0 end)) bgap,
      abs(avg(challenger_p)-avg(case when actual then 1.0 else 0.0 end)) cgap,max(evidence_at) latest from scored
  ) select n,positives,negatives,bb,cb,improvement,lower,bll,cll,bgap,cgap,latest
    into paired_days,positive_days,negative_days,baseline_brier,challenger_brier,mean_improvement,ci_low,baseline_logloss,challenger_logloss,baseline_gap,challenger_gap,latest_evidence from stats;
  if qualification_at is null or not isfinite(qualification_at) or qualification_at<latest_evidence or qualification_at>clock_timestamp()+interval '5 minutes'
    or paired_days<20 or positive_days<2 or negative_days<2 or ci_low<=0 or challenger_brier>=baseline_brier or challenger_logloss>=baseline_logloss or challenger_gap>baseline_gap+0.02
    or (p_qualification->>'pairedDays')::integer<>paired_days or (p_qualification->>'positiveDays')::integer<>positive_days or (p_qualification->>'negativeDays')::integer<>negative_days
    or abs((p_qualification->>'baselineBrier')::double precision-baseline_brier)>0.000002 or abs((p_qualification->>'challengerBrier')::double precision-challenger_brier)>0.000002
    or abs((p_qualification->>'meanBrierImprovement')::double precision-mean_improvement)>0.000002 or abs((p_qualification->>'improvementCi95Low')::double precision-ci_low)>0.000002
    or abs((p_qualification->>'baselineLogLoss')::double precision-baseline_logloss)>0.000002 or abs((p_qualification->>'challengerLogLoss')::double precision-challenger_logloss)>0.000002
    or abs((p_qualification->>'baselineCalibrationGap')::double precision-baseline_gap)>0.000002 or abs((p_qualification->>'challengerCalibrationGap')::double precision-challenger_gap)>0.000002
  then raise exception 'PERSONAL_MODEL_QUALIFICATION_EVIDENCE_MISMATCH';end if;
  update public.personal_model_artifacts set status='qualified',qualification=p_qualification where id=p_artifact_id and user_id=p_user_id and status='shadow';
  get diagnostics changed=row_count;return changed=1;
end $$;
revoke all on function public.qualify_personal_completion_artifact(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.qualify_personal_completion_artifact(uuid,uuid,jsonb) to service_role;
