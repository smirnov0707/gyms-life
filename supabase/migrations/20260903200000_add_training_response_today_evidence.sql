-- A response-derived volume guard is valid only when deterministic athlete
-- state has sufficient recent, user-reported evidence. These constraints keep
-- persisted Today decisions in step with the canonical Zod contract.

alter table public.decision_evidence
  drop constraint if exists decision_evidence_key;

alter table public.decision_evidence
  add constraint decision_evidence_key
    check (evidence_key in (
      'active_training_plan',
      'today_readiness',
      'completed_workout_today',
      'sessions_last_7_days',
      'load_modifier',
      'model_data_quality',
      'active_life_context',
      'recent_decision_feedback',
      'training_rhythm',
      'recent_training_response'
    )) not valid;

alter table public.decision_evidence
  validate constraint decision_evidence_key;

alter table public.decision_records
  drop constraint if exists decision_records_safety_constraints_valid;

alter table public.decision_records
  add constraint decision_records_safety_constraints_valid
    check (safety_constraints <@ array[
      'requires_active_plan_before_training',
      'do_not_adapt_load_without_today_checkin',
      'avoid_progression_when_readiness_low',
      'apply_persisted_readiness_modifier',
      'apply_persisted_execution_snapshot',
      'apply_training_response_volume_guard',
      'avoid_duplicate_training_prompt',
      'avoid_training_with_active_limitation'
    ]::text[]) not valid;

alter table public.decision_records
  validate constraint decision_records_safety_constraints_valid;
