-- `plans` is a raw database source, but its inexpensive structural
-- invariants belong in Postgres as well as in the validated domain mapper.
alter table public.plans
  drop constraint if exists plans_days_per_week_range,
  drop constraint if exists plans_weeks_range,
  drop constraint if exists plans_data_days_match_frequency;

alter table public.plans
  add constraint plans_days_per_week_range
    check (days_per_week between 1 and 7) not valid,
  add constraint plans_weeks_range
    check (weeks between 1 and 104) not valid,
  add constraint plans_data_days_match_frequency
    check (
      jsonb_typeof(data) = 'object'
      and jsonb_typeof(data -> 'days') = 'array'
      and jsonb_array_length(data -> 'days') = days_per_week
    ) not valid;

alter table public.plans
  validate constraint plans_days_per_week_range,
  validate constraint plans_weeks_range,
  validate constraint plans_data_days_match_frequency;

-- The activation RPC serializes transitions; this partial unique index also
-- protects the canonical active-plan source from direct concurrent writes.
create unique index if not exists plans_one_active_per_user_idx
  on public.plans (user_id)
  where is_active = true;
