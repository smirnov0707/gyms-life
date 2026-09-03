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
      'avoid_duplicate_training_prompt',
      'avoid_training_with_active_limitation'
    ]::text[]) not valid;

alter table public.decision_records
  validate constraint decision_records_safety_constraints_valid;
