-- Future Lab Phase 1.5: provenance describes where a value came from.
-- "known" and "unknown" are epistemic states, not provenance sources.
-- personal_timeline_events is currently empty in production, so this narrows
-- the contract without rewriting user history.

alter table public.personal_timeline_events
  drop constraint if exists personal_timeline_provenance;

alter table public.personal_timeline_events
  add constraint personal_timeline_provenance
  check (provenance in (
    'measured',
    'user_reported',
    'device_reported',
    'calculated',
    'inferred',
    'predicted',
    'simulated'
  ));

comment on column public.personal_timeline_events.provenance is
  'Origin semantics only: measured, user_reported, device_reported, calculated, inferred, predicted, or simulated. Unknown/known belong to evidence state, not provenance.';
