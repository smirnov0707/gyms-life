-- Final reproducible contract for the first policy canary.
-- Shadow-only: no assignment, delivered strategy, exposure, or decision authority.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.athlete_state_snapshots'::regclass
      AND conname='athlete_state_snapshots_id_user_unique'
  ) THEN
    ALTER TABLE public.athlete_state_snapshots
      ADD CONSTRAINT athlete_state_snapshots_id_user_unique UNIQUE(id,user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.policy_shadow_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_id uuid NOT NULL,
  model_artifact_id uuid NOT NULL,
  policy_id text NOT NULL,
  policy_version text NOT NULL,
  source_prediction_id uuid NOT NULL,
  baseline_probability double precision NOT NULL
    CHECK (baseline_probability BETWEEN 0.001 AND 0.999),
  qualified_probability double precision NOT NULL
    CHECK (qualified_probability BETWEEN 0.001 AND 0.999),
  baseline_strategy text NOT NULL CHECK (baseline_strategy='standard_train_cta'),
  candidate_strategy text NOT NULL
    CHECK (candidate_strategy IN ('standard_train_cta','choose_start_time_first')),
  comparison text NOT NULL
    CHECK (comparison IN ('equivalent_shadow','counterfactual_unobserved')),
  safety_envelope text NOT NULL
    CHECK (safety_envelope='presentation_only_no_training_load_change'),
  mode text NOT NULL DEFAULT 'shadow' CHECK (mode='shadow'),
  assignment text CHECK (assignment IS NULL),
  delivered_strategy text CHECK (delivered_strategy IS NULL),
  exposure_at timestamptz CHECK (exposure_at IS NULL),
  created_at timestamptz NOT NULL DEFAULT now(),
  decision_action text NOT NULL
    CHECK (decision_action IN ('train_as_planned','train_adapted')),
  athlete_state_snapshot_id uuid NOT NULL,
  generated_at timestamptz NOT NULL,
  horizon_ends_at timestamptz NOT NULL CHECK (horizon_ends_at>generated_at),
  exposure_state text NOT NULL DEFAULT 'shadow_unexposed'
    CHECK (exposure_state='shadow_unexposed'),
  decision_authority boolean NOT NULL DEFAULT false CHECK (decision_authority=false),
  decision_on date NOT NULL,
  observed_completion boolean,
  outcome_observed_at timestamptz,
  reviewed_at timestamptz,
  CONSTRAINT policy_shadow_records_one_policy_per_decision
    UNIQUE(user_id,decision_id,policy_id,policy_version),
  CONSTRAINT policy_shadow_records_daily_unique
    UNIQUE(user_id,decision_on,policy_id,policy_version),
  CONSTRAINT policy_shadow_records_outcome_atomic CHECK (
    (observed_completion IS NULL AND outcome_observed_at IS NULL AND reviewed_at IS NULL)
    OR
    (observed_completion IS NOT NULL AND outcome_observed_at IS NOT NULL
      AND reviewed_at IS NOT NULL AND reviewed_at>=outcome_observed_at)
  ),
  CONSTRAINT policy_shadow_records_artifact_owner_fkey
    FOREIGN KEY(model_artifact_id,user_id)
      REFERENCES public.personal_model_artifacts(id,user_id) ON DELETE RESTRICT,
  CONSTRAINT policy_shadow_records_decision_owner_fkey
    FOREIGN KEY(decision_id,user_id)
      REFERENCES public.decision_records(id,user_id) ON DELETE CASCADE,
  CONSTRAINT policy_shadow_records_snapshot_owner_fkey
    FOREIGN KEY(athlete_state_snapshot_id,user_id)
      REFERENCES public.athlete_state_snapshots(id,user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS policy_shadow_records_artifact_idx
  ON public.policy_shadow_records(model_artifact_id,user_id);
CREATE INDEX IF NOT EXISTS policy_shadow_records_user_recent_idx
  ON public.policy_shadow_records(user_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS policy_shadow_records_user_day_idx
  ON public.policy_shadow_records(user_id,decision_on DESC,id DESC);
CREATE INDEX IF NOT EXISTS policy_shadow_records_pending_idx
  ON public.policy_shadow_records(horizon_ends_at,user_id,id)
  WHERE reviewed_at IS NULL;

ALTER TABLE public.policy_shadow_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.policy_shadow_records FROM public,anon,authenticated;
GRANT SELECT ON public.policy_shadow_records TO authenticated;
GRANT ALL ON public.policy_shadow_records TO service_role;
DROP POLICY IF EXISTS policy_shadow_records_owner_read ON public.policy_shadow_records;
CREATE POLICY policy_shadow_records_owner_read
  ON public.policy_shadow_records FOR SELECT TO authenticated
  USING(user_id=(SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.commit_today_engagement_policy_shadow(
  p_user_id uuid,
  p_decision_id uuid,
  p_artifact_id uuid,
  p_proposal jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  artifact public.personal_model_artifacts%rowtype;
  decision public.decision_records%rowtype;
  existing public.policy_shadow_records%rowtype;
  baseline_p double precision;
  qualified_p double precision;
  offset_value double precision;
  expected_strategy text;
  expected_comparison text;
  result_id uuid;
  proposal_generated timestamptz;
  proposal_horizon timestamptz;
  proposal_day date;
BEGIN
  IF p_proposal IS NULL OR jsonb_typeof(p_proposal)<>'object'
    OR p_proposal->>'policyId' IS DISTINCT FROM 'today-training-engagement'
    OR p_proposal->>'policyVersion' IS DISTINCT FROM '0.1.0'
    OR p_proposal->>'decisionId' IS DISTINCT FROM p_decision_id::text
    OR p_proposal->>'modelArtifactId' IS DISTINCT FROM p_artifact_id::text
    OR p_proposal->>'baselineStrategy' IS DISTINCT FROM 'standard_train_cta'
    OR p_proposal->>'safetyEnvelope' IS DISTINCT FROM 'presentation_only_no_training_load_change'
    OR p_proposal->>'exposureState' IS DISTINCT FROM 'shadow_unexposed'
    OR p_proposal->'decisionAuthority' IS DISTINCT FROM 'false'::jsonb
  THEN RAISE EXCEPTION 'POLICY_SHADOW_INVALID_PROPOSAL'; END IF;

  proposal_day := (p_proposal->>'decisionOn')::date;
  SELECT * INTO existing FROM public.policy_shadow_records
    WHERE user_id=p_user_id AND decision_on=proposal_day
      AND policy_id='today-training-engagement' AND policy_version='0.1.0';
  IF FOUND THEN
    IF existing.decision_id<>p_decision_id
      OR existing.model_artifact_id<>p_artifact_id
      OR existing.source_prediction_id::text IS DISTINCT FROM p_proposal->>'sourcePredictionId'
      OR existing.decision_action IS DISTINCT FROM p_proposal->>'decisionAction'
      OR existing.athlete_state_snapshot_id::text IS DISTINCT FROM p_proposal->>'athleteStateSnapshotId'
      OR existing.generated_at IS DISTINCT FROM (p_proposal->>'generatedAt')::timestamptz
      OR existing.horizon_ends_at IS DISTINCT FROM (p_proposal->>'horizonEndsAt')::timestamptz
      OR abs(existing.baseline_probability-(p_proposal->>'baselineProbability')::double precision)>0.000001
      OR abs(existing.qualified_probability-(p_proposal->>'qualifiedProbability')::double precision)>0.000001
      OR existing.candidate_strategy IS DISTINCT FROM p_proposal->>'candidateStrategy'
      OR existing.comparison IS DISTINCT FROM p_proposal->>'comparison'
      OR existing.mode<>'shadow' OR existing.assignment IS NOT NULL
      OR existing.delivered_strategy IS NOT NULL OR existing.exposure_at IS NOT NULL
      OR existing.exposure_state<>'shadow_unexposed' OR existing.decision_authority
    THEN RAISE EXCEPTION 'POLICY_SHADOW_RETRY_CONFLICT'; END IF;
    RETURN existing.id;
  END IF;

  SELECT * INTO artifact FROM public.personal_model_artifacts
    WHERE id=p_artifact_id AND user_id=p_user_id AND status='qualified';
  IF NOT FOUND
    OR artifact.model_id<>'workout-completion-personal-logit-offset'
    OR artifact.algorithm_version<>'0.1.0'
    OR artifact.parameters->>'kind' IS DISTINCT FROM 'logit_offset_v1'
    OR jsonb_typeof(artifact.parameters->'logOddsOffset')<>'number'
  THEN RAISE EXCEPTION 'POLICY_SHADOW_QUALIFIED_MODEL_REQUIRED'; END IF;
  offset_value := (artifact.parameters->>'logOddsOffset')::double precision;
  IF offset_value < -1.5 OR offset_value > 1.5 THEN
    RAISE EXCEPTION 'POLICY_SHADOW_MODEL_INVALID';
  END IF;
  IF proposal_day<=artifact.trained_through THEN
    RAISE EXCEPTION 'POLICY_SHADOW_TRAINING_LEAKAGE';
  END IF;

  SELECT * INTO decision FROM public.decision_records
    WHERE id=p_decision_id AND user_id=p_user_id;
  IF NOT FOUND
    OR decision.action NOT IN ('train_as_planned','train_adapted')
    OR p_proposal->>'decisionAction' IS DISTINCT FROM decision.action
    OR proposal_day IS DISTINCT FROM decision.decision_on
    OR p_proposal->>'athleteStateSnapshotId' IS DISTINCT FROM decision.athlete_state_snapshot_id::text
    OR decision.prediction IS NULL
    OR decision.prediction->>'target' IS DISTINCT FROM 'workout_completion'
    OR decision.prediction->>'modelId' IS DISTINCT FROM artifact.source_model_id
    OR decision.prediction->>'modelVersion' IS DISTINCT FROM artifact.source_model_version
    OR decision.prediction#>>'{predicted,kind}' IS DISTINCT FROM 'probability'
    OR jsonb_typeof(decision.prediction#>'{predicted,value}')<>'number'
    OR decision.prediction->'actual' IS DISTINCT FROM 'null'::jsonb
    OR decision.prediction->'evaluatedAt' IS DISTINCT FROM 'null'::jsonb
    OR p_proposal->>'sourcePredictionId' IS DISTINCT FROM decision.prediction->>'id'
    OR p_proposal->>'generatedAt' IS DISTINCT FROM decision.prediction->>'generatedAt'
    OR p_proposal->>'horizonEndsAt' IS DISTINCT FROM decision.prediction->>'horizonEndsAt'
    OR p_proposal->>'athleteStateSnapshotId' IS DISTINCT FROM decision.prediction->>'athleteStateSnapshotId'
  THEN RAISE EXCEPTION 'POLICY_SHADOW_DECISION_INELIGIBLE'; END IF;

  proposal_generated := (p_proposal->>'generatedAt')::timestamptz;
  proposal_horizon := (p_proposal->>'horizonEndsAt')::timestamptz;
  IF proposal_generated IS NULL OR proposal_horizon IS NULL
    OR NOT isfinite(proposal_generated) OR NOT isfinite(proposal_horizon)
    OR proposal_horizon<=proposal_generated
  THEN RAISE EXCEPTION 'POLICY_SHADOW_TIME_INVALID'; END IF;

  baseline_p := least(0.999,greatest(0.001,
    (decision.prediction#>>'{predicted,value}')::double precision));
  qualified_p := round(least(0.999,greatest(0.001,
    1.0/(1.0+exp(-(ln(baseline_p/(1.0-baseline_p))+offset_value)))))::numeric,6)::double precision;
  expected_strategy := CASE WHEN qualified_p<0.45
    THEN 'choose_start_time_first' ELSE 'standard_train_cta' END;
  expected_comparison := CASE WHEN expected_strategy='standard_train_cta'
    THEN 'equivalent_shadow' ELSE 'counterfactual_unobserved' END;

  IF abs((p_proposal->>'baselineProbability')::double precision-baseline_p)>0.000001
    OR abs((p_proposal->>'qualifiedProbability')::double precision-qualified_p)>0.000001
    OR p_proposal->>'candidateStrategy' IS DISTINCT FROM expected_strategy
    OR p_proposal->>'comparison' IS DISTINCT FROM expected_comparison
  THEN RAISE EXCEPTION 'POLICY_SHADOW_FORMULA_MISMATCH'; END IF;

  INSERT INTO public.policy_shadow_records(
    user_id,decision_id,decision_on,model_artifact_id,policy_id,policy_version,
    source_prediction_id,decision_action,athlete_state_snapshot_id,generated_at,horizon_ends_at,
    baseline_probability,qualified_probability,baseline_strategy,candidate_strategy,comparison,
    safety_envelope,exposure_state,decision_authority
  ) VALUES (
    p_user_id,p_decision_id,proposal_day,p_artifact_id,'today-training-engagement','0.1.0',
    (p_proposal->>'sourcePredictionId')::uuid,decision.action,decision.athlete_state_snapshot_id,
    proposal_generated,proposal_horizon,baseline_p,qualified_p,'standard_train_cta',
    expected_strategy,expected_comparison,'presentation_only_no_training_load_change',
    'shadow_unexposed',false
  ) RETURNING id INTO result_id;
  RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.commit_today_engagement_policy_shadow(uuid,uuid,uuid,jsonb)
  FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_today_engagement_policy_shadow(uuid,uuid,uuid,jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.evaluate_today_engagement_policy_shadow(
  p_user_id uuid,
  p_record_id uuid,
  p_reviewed_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  shadow public.policy_shadow_records%rowtype;
  decision public.decision_records%rowtype;
  observed boolean;
  observed_at timestamptz;
  changed integer;
BEGIN
  IF p_reviewed_at IS NULL OR NOT isfinite(p_reviewed_at)
    OR p_reviewed_at>clock_timestamp()+interval '5 minutes'
  THEN RAISE EXCEPTION 'POLICY_SHADOW_REVIEW_TIME_INVALID'; END IF;

  SELECT * INTO shadow FROM public.policy_shadow_records
    WHERE id=p_record_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POLICY_SHADOW_NOT_FOUND'; END IF;
  IF shadow.mode<>'shadow' OR shadow.assignment IS NOT NULL
    OR shadow.delivered_strategy IS NOT NULL OR shadow.exposure_at IS NOT NULL
    OR shadow.exposure_state<>'shadow_unexposed' OR shadow.decision_authority
  THEN RAISE EXCEPTION 'POLICY_SHADOW_EXPOSURE_CONFLICT'; END IF;

  IF shadow.reviewed_at IS NOT NULL THEN
    IF shadow.observed_completion IS NULL OR shadow.outcome_observed_at IS NULL THEN
      RAISE EXCEPTION 'POLICY_SHADOW_OUTCOME_CORRUPT';
    END IF;
    RETURN true;
  END IF;

  SELECT * INTO decision FROM public.decision_records
    WHERE id=shadow.decision_id AND user_id=p_user_id;
  IF NOT FOUND OR decision.prediction IS NULL
    OR decision.prediction->>'id' IS DISTINCT FROM shadow.source_prediction_id::text
    OR decision.prediction->>'target' IS DISTINCT FROM 'workout_completion'
    OR decision.prediction#>>'{predicted,kind}' IS DISTINCT FROM 'probability'
    OR (decision.prediction->>'generatedAt')::timestamptz IS DISTINCT FROM shadow.generated_at
    OR (decision.prediction->>'horizonEndsAt')::timestamptz IS DISTINCT FROM shadow.horizon_ends_at
    OR decision.prediction->>'athleteStateSnapshotId' IS DISTINCT FROM shadow.athlete_state_snapshot_id::text
  THEN RAISE EXCEPTION 'POLICY_SHADOW_OUTCOME_SOURCE_INVALID'; END IF;

  IF decision.prediction->'actual' IS NULL OR decision.prediction->'actual'='null'::jsonb
    OR decision.prediction->'evaluatedAt' IS NULL OR decision.prediction->'evaluatedAt'='null'::jsonb
  THEN RETURN false; END IF;
  IF decision.prediction#>>'{actual,kind}' IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(decision.prediction#>'{actual,value}')<>'boolean'
  THEN RAISE EXCEPTION 'POLICY_SHADOW_OUTCOME_SOURCE_INVALID'; END IF;

  observed := (decision.prediction#>>'{actual,value}')::boolean;
  observed_at := (decision.prediction->>'evaluatedAt')::timestamptz;
  IF observed_at IS NULL OR NOT isfinite(observed_at) OR observed_at>p_reviewed_at
    OR (observed AND observed_at>shadow.horizon_ends_at)
    OR (NOT observed AND observed_at<shadow.horizon_ends_at)
  THEN RAISE EXCEPTION 'POLICY_SHADOW_OUTCOME_TIME_INVALID'; END IF;

  UPDATE public.policy_shadow_records
    SET observed_completion=observed,outcome_observed_at=observed_at,reviewed_at=p_reviewed_at
    WHERE id=shadow.id AND user_id=p_user_id AND reviewed_at IS NULL;
  GET DIAGNOSTICS changed=row_count;
  IF changed<>1 THEN RAISE EXCEPTION 'POLICY_SHADOW_OUTCOME_WRITE_UNCONFIRMED'; END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.evaluate_today_engagement_policy_shadow(uuid,uuid,timestamptz)
  FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_today_engagement_policy_shadow(uuid,uuid,timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.commit_night_lab_review(
  p_run_id uuid,p_claimed_at timestamptz,p_user_id uuid,p_report jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  job public.background_job_runs%rowtype;
  result_id uuid;
  v_zone text;
  v_snapshot uuid;
  v_evidence_at timestamptz;
  v_reviewed_at timestamptz;
  v_report_day date;
BEGIN
  IF p_report IS NULL OR jsonb_typeof(p_report)<>'object' OR octet_length(p_report::text)>100000
    OR p_report->>'version' IS DISTINCT FROM '1.0'
    OR coalesce(p_report->>'status','') NOT IN ('completed','partial','blocked')
    OR p_report->'modelChanged' IS DISTINCT FROM 'false'::jsonb
    OR p_report->'planChanged' IS DISTINCT FROM 'false'::jsonb
  THEN RAISE EXCEPTION 'NIGHT_REVIEW_INVALID_REPORT'; END IF;

  SELECT * INTO job FROM public.background_job_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND OR job.job_name<>'night_lab' OR job.status<>'running'
    OR job.started_at<>p_claimed_at OR p_claimed_at IS NULL
    OR clock_timestamp()>job.started_at+interval '30 minutes'
  THEN RAISE EXCEPTION 'NIGHT_REVIEW_STALE_CLAIM'; END IF;
  IF p_report->>'runKey' IS DISTINCT FROM job.run_key THEN
    RAISE EXCEPTION 'NIGHT_REVIEW_RUN_MISMATCH';
  END IF;

  v_zone := p_report->>'timeZone';
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=v_zone) THEN
    RAISE EXCEPTION 'NIGHT_REVIEW_INVALID_ZONE';
  END IF;
  v_evidence_at := (p_report->>'evidenceThrough')::timestamptz;
  v_reviewed_at := (p_report->>'reviewedAt')::timestamptz;
  v_report_day := (p_report->>'reviewOn')::date;
  IF v_evidence_at IS NULL OR v_reviewed_at IS NULL OR v_report_day IS NULL
    OR NOT isfinite(v_evidence_at) OR NOT isfinite(v_reviewed_at)
    OR v_evidence_at<>job.window_end OR v_reviewed_at<v_evidence_at
    OR v_reviewed_at>clock_timestamp()+interval '5 minutes'
    OR v_report_day<>(v_evidence_at AT TIME ZONE v_zone)::date
  THEN RAISE EXCEPTION 'NIGHT_REVIEW_INVALID_TIME'; END IF;

  IF p_report#>>'{snapshot,status}'='confirmed' THEN
    v_snapshot := (p_report#>>'{snapshot,id}')::uuid;
    IF v_snapshot IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.athlete_state_snapshots
      WHERE id=v_snapshot AND user_id=p_user_id
    ) THEN RAISE EXCEPTION 'NIGHT_REVIEW_SNAPSHOT_OWNER'; END IF;
    IF p_report->>'status'='blocked' THEN RAISE EXCEPTION 'NIGHT_REVIEW_STAGE_MISMATCH'; END IF;
  ELSE
    IF coalesce(p_report#>>'{snapshot,status}','') NOT IN ('blocked','unavailable')
      OR p_report->>'status'<>'blocked'
      OR p_report#>>'{predictions,status}' IS DISTINCT FROM 'not_run'
      OR p_report#>>'{hypotheses,status}' IS DISTINCT FROM 'not_run'
      OR (p_report ? 'modelLearning' AND p_report#>>'{modelLearning,status}' IS DISTINCT FROM 'not_run')
      OR (p_report ? 'policyCanary' AND p_report#>>'{policyCanary,status}' IS DISTINCT FROM 'not_run')
    THEN RAISE EXCEPTION 'NIGHT_REVIEW_STAGE_MISMATCH'; END IF;
  END IF;

  IF p_report ? 'modelLearning'
    AND coalesce(p_report#>>'{modelLearning,status}','') NOT IN ('completed','unavailable','not_run')
  THEN RAISE EXCEPTION 'NIGHT_REVIEW_STAGE_MISMATCH'; END IF;
  IF p_report ? 'policyCanary'
    AND coalesce(p_report#>>'{policyCanary,status}','') NOT IN ('completed','unavailable','not_run')
  THEN RAISE EXCEPTION 'NIGHT_REVIEW_STAGE_MISMATCH'; END IF;

  IF p_report#>>'{policyCanary,status}'='completed' AND (
    p_report#>'{policyCanary,result,readiness,randomizedExposures}' IS DISTINCT FROM '0'::jsonb
    OR p_report#>'{policyCanary,result,readiness,causalEvidence}' IS DISTINCT FROM 'false'::jsonb
    OR p_report#>'{policyCanary,result,readiness,promotionEligible}' IS DISTINCT FROM 'false'::jsonb
    OR jsonb_typeof(p_report#>'{policyCanary,result,outcomeReview,checked}')<>'number'
    OR jsonb_typeof(p_report#>'{policyCanary,result,outcomeReview,evaluated}')<>'number'
    OR jsonb_typeof(p_report#>'{policyCanary,result,outcomeReview,limited}')<>'boolean'
    OR (p_report#>>'{policyCanary,result,outcomeReview,evaluated}')::integer
       >(p_report#>>'{policyCanary,result,outcomeReview,checked}')::integer
  ) THEN RAISE EXCEPTION 'NIGHT_REVIEW_POLICY_CANARY_INVALID'; END IF;

  IF p_report->>'status'='completed' AND (
    p_report#>>'{predictions,status}' IS DISTINCT FROM 'completed'
    OR p_report#>>'{hypotheses,status}' IS DISTINCT FROM 'completed'
    OR (p_report ? 'modelLearning' AND (
      p_report#>>'{modelLearning,status}' IS DISTINCT FROM 'completed'
      OR coalesce((p_report#>>'{modelLearning,predictionReview,limited}')::boolean,false)
    ))
    OR (p_report ? 'policyCanary' AND (
      p_report#>>'{policyCanary,status}' IS DISTINCT FROM 'completed'
      OR coalesce((p_report#>>'{policyCanary,result,outcomeReview,limited}')::boolean,false)
    ))
  ) THEN RAISE EXCEPTION 'NIGHT_REVIEW_STAGE_MISMATCH'; END IF;

  INSERT INTO public.night_lab_reviews(
    run_id,user_id,run_key,review_on,time_zone,reviewed_at,snapshot_id,report
  ) VALUES (
    p_run_id,p_user_id,job.run_key,v_report_day,v_zone,v_reviewed_at,v_snapshot,p_report
  ) ON CONFLICT(run_id,user_id) DO NOTHING RETURNING id INTO result_id;
  IF result_id IS NULL THEN
    SELECT id INTO result_id FROM public.night_lab_reviews
      WHERE run_id=p_run_id AND user_id=p_user_id;
  END IF;
  RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.commit_night_lab_review(uuid,timestamptz,uuid,jsonb)
  FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_night_lab_review(uuid,timestamptz,uuid,jsonb)
  TO service_role;

COMMENT ON TABLE public.policy_shadow_records IS
  'Shadow-only policy counterfactuals. No row represents a delivered intervention or causal effect.';