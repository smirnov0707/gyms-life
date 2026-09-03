-- Today decision percentages were never calibrated prediction probabilities.
-- Preserve historic values for auditability, but store an explainable basis for
-- every deterministic Today decision produced by engine v1.9 and later.

alter table public.decision_records
  add column if not exists decision_basis text not null default 'current_day_fact';

alter table public.decision_records
  drop constraint if exists decision_records_decision_basis_valid;

alter table public.decision_records
  add constraint decision_records_decision_basis_valid
    check (decision_basis in (
      'safety_rule',
      'current_day_fact',
      'current_checkin',
      'observed_pattern'
    )) not valid;

alter table public.decision_records
  validate constraint decision_records_decision_basis_valid;

-- The legacy column remains available for historic records. New decision
-- inserts omit it deliberately, so the default does not imply a probability.
alter table public.decision_records
  alter column confidence set default 0;

comment on column public.decision_records.decision_basis is
  'Explainable non-probabilistic basis for deterministic Today decision engine v1.9+.';

comment on column public.decision_records.confidence is
  'Deprecated legacy numerical value. New Today decisions use decision_basis instead of a percentage.';
