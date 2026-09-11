alter table public.personal_experiments
  add column if not exists requires_medication_change boolean not null default false,
  add column if not exists requires_supplement_escalation boolean not null default false,
  add column if not exists requires_sleep_restriction boolean not null default false,
  add column if not exists requires_fasting_beyond_normal_routine boolean not null default false;

comment on column public.personal_experiments.requires_medication_change is
  'Original governed protocol input retained for experiment auditability.';
comment on column public.personal_experiments.requires_supplement_escalation is
  'Original governed protocol input retained for experiment auditability.';
comment on column public.personal_experiments.requires_sleep_restriction is
  'Original governed protocol input retained for experiment auditability.';
comment on column public.personal_experiments.requires_fasting_beyond_normal_routine is
  'Original governed protocol input retained for experiment auditability.';