alter table public.endurance_race_goals add column if not exists started_on date;
update public.endurance_race_goals set started_on=created_at::date where started_on is null;
alter table public.endurance_race_goals alter column started_on set not null;
