create or replace function public.guard_endurance_activity_provenance() returns trigger language plpgsql set search_path=public as $$
begin
 if auth.role()<>'service_role'
    and (new.activity_source in ('device','wearable','imported') or (tg_op='UPDATE' and old.activity_source in ('device','wearable','imported')))
    and (
      tg_op='INSERT'
      or old.activity_source is distinct from new.activity_source
      or old.activity_kind is distinct from new.activity_kind
      or old.distance_meters is distinct from new.distance_meters
      or old.duration_seconds is distinct from new.duration_seconds
    )
 then
   raise exception 'device endurance provenance is server-owned';
 end if;
 return new;
end$$;

drop trigger if exists workout_sessions_guard_endurance_activity_provenance on public.workout_sessions;
create trigger workout_sessions_guard_endurance_activity_provenance
before insert or update on public.workout_sessions
for each row execute function public.guard_endurance_activity_provenance();

revoke all on function public.guard_endurance_activity_provenance() from public,anon,authenticated;
