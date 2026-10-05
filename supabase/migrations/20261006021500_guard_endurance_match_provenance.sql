create or replace function public.guard_endurance_match_provenance() returns trigger language plpgsql set search_path=public as $$
begin
 if auth.role()<>'service_role' and new.endurance_match_source='system_confident' and (old.endurance_match_source is distinct from new.endurance_match_source or old.endurance_session_intent is distinct from new.endurance_session_intent or old.endurance_match_score is distinct from new.endurance_match_score) then raise exception 'system_confident provenance is server-owned';end if;
 return new;
end$$;
drop trigger if exists workout_sessions_guard_endurance_match_provenance on public.workout_sessions;
create trigger workout_sessions_guard_endurance_match_provenance before update on public.workout_sessions for each row execute function public.guard_endurance_match_provenance();
revoke all on function public.guard_endurance_match_provenance() from public,anon,authenticated;
grant execute on function public.guard_endurance_match_provenance() to service_role;
