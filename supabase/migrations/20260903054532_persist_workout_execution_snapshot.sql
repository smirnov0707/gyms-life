alter table public.workout_sessions
  add column if not exists workout_snapshot jsonb;

alter table public.workout_sessions
  drop constraint if exists workout_sessions_snapshot_is_object;

alter table public.workout_sessions
  add constraint workout_sessions_snapshot_is_object
  check (workout_snapshot is null or jsonb_typeof(workout_snapshot) = 'object') not valid;

alter table public.workout_sessions
  validate constraint workout_sessions_snapshot_is_object;

create or replace function public.prevent_workout_snapshot_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.workout_snapshot is distinct from old.workout_snapshot then
    raise exception using
      errcode = '22023',
      message = 'Workout execution snapshot is immutable after session creation.';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_workout_snapshot_mutation() from public, anon, authenticated;

drop trigger if exists workout_sessions_snapshot_immutable on public.workout_sessions;

create trigger workout_sessions_snapshot_immutable
before update on public.workout_sessions
for each row execute function public.prevent_workout_snapshot_mutation();

comment on column public.workout_sessions.workout_snapshot is
  'Validated, immutable execution plan and deterministic adaptation provenance captured at workout start.';
