-- Future Lab Phase 1: extend existing canonical snapshots and decision ledger.
-- This is additive and preserves all existing Digital Athlete / Today flows.

alter table public.athlete_state_snapshots
  add column if not exists calculation_version text not null default 'digital-athlete-v1',
  add column if not exists source_window_start timestamptz,
  add column if not exists source_window_end timestamptz,
  add column if not exists provenance_summary jsonb not null default '{}'::jsonb,
  add column if not exists uncertainty_summary jsonb not null default '{}'::jsonb;

alter table public.athlete_state_snapshots
  add constraint athlete_state_snapshots_source_window_order
  check (source_window_start is null or source_window_end is null or source_window_start <= source_window_end);

alter table public.athlete_state_snapshots
  add constraint athlete_state_snapshots_provenance_object
  check (jsonb_typeof(provenance_summary) = 'object'),
  add constraint athlete_state_snapshots_uncertainty_object
  check (jsonb_typeof(uncertainty_summary) = 'object');

comment on column public.athlete_state_snapshots.calculation_version is 'Version of deterministic/derived logic used to compute this state snapshot; distinct from schema_version.';
comment on column public.athlete_state_snapshots.provenance_summary is 'Compact provenance metadata for the state; raw source facts remain in canonical domain tables.';
comment on column public.athlete_state_snapshots.uncertainty_summary is 'Structured uncertainty metadata. Empty means legacy/not-yet-populated, never certainty.';

alter table public.decision_records
  add column if not exists prediction jsonb,
  add column if not exists uncertainty jsonb,
  add column if not exists safety_check jsonb,
  add column if not exists model_versions jsonb not null default '{}'::jsonb,
  add column if not exists user_override jsonb;

alter table public.decision_records
  add constraint decision_records_prediction_object check (prediction is null or jsonb_typeof(prediction) = 'object'),
  add constraint decision_records_uncertainty_object check (uncertainty is null or jsonb_typeof(uncertainty) = 'object'),
  add constraint decision_records_safety_check_object check (safety_check is null or jsonb_typeof(safety_check) = 'object'),
  add constraint decision_records_model_versions_object check (jsonb_typeof(model_versions) = 'object'),
  add constraint decision_records_user_override_object check (user_override is null or jsonb_typeof(user_override) = 'object');

comment on table public.decision_records is 'Server-owned Decision Ledger. Records the selected action and its auditable snapshot, evidence, safety, uncertainty and model context.';
