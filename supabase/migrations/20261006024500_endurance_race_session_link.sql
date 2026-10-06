alter table public.workout_sessions
  add column if not exists endurance_race_goal_id uuid references public.endurance_race_goals(id) on delete set null;

create unique index if not exists workout_sessions_unique_endurance_plan_match
  on public.workout_sessions(user_id,endurance_race_goal_id,endurance_plan_session_key)
  where endurance_race_goal_id is not null and endurance_plan_session_key is not null;

create or replace function public.guard_endurance_race_goal_link() returns trigger language plpgsql set search_path=public as $$
begin
 if new.endurance_race_goal_id is not null and not exists(
   select 1 from public.endurance_race_goals g where g.id=new.endurance_race_goal_id and g.user_id=new.user_id
 ) then raise exception 'endurance race goal ownership mismatch';end if;
 return new;
end$$;
drop trigger if exists workout_sessions_guard_endurance_race_goal_link on public.workout_sessions;
create trigger workout_sessions_guard_endurance_race_goal_link before insert or update on public.workout_sessions for each row execute function public.guard_endurance_race_goal_link();
revoke all on function public.guard_endurance_race_goal_link() from public,anon,authenticated;
