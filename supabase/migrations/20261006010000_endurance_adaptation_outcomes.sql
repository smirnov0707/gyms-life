alter table public.endurance_adaptation_records add column if not exists outcome jsonb,add column if not exists outcome_recorded_at timestamptz;
comment on column public.endurance_adaptation_records.outcome is 'Observed post-decision evidence. Association only; not causal proof.';
