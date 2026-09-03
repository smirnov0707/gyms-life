-- Feedback is stored as a compact, user-owned evidence item. It can lower a
-- confidence label only when several explicit outcomes exist; it never
-- changes an action or bypasses a safety constraint.
alter table public.decision_evidence
  drop constraint if exists decision_evidence_key;

alter table public.decision_evidence
  add constraint decision_evidence_key
    check (evidence_key in (
      'active_training_plan', 'today_readiness', 'completed_workout_today',
      'sessions_last_7_days', 'load_modifier', 'model_data_quality',
      'active_life_context', 'recent_decision_feedback'
    )) not valid;

alter table public.decision_evidence
  validate constraint decision_evidence_key;

comment on table public.decision_outcomes is
  'One explicit athlete outcome for a Today decision; aggregated only after sufficient evidence to calibrate future confidence labels.';
