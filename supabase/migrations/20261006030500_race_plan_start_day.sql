alter table public.endurance_race_goals add column if not exists plan_start_day date;
update public.endurance_race_goals set plan_start_day=created_at::date where plan_start_day is null;
alter table public.endurance_race_goals alter column plan_start_day set not null;
