-- A caller owning a child row must also own its referenced workout/plan.
-- Add restrictive policies alongside the existing per-user policies; never widen access.
-- No user records are modified or deleted by this migration.
drop policy if exists workout_sessions_parent_ownership on public.workout_sessions;
create policy workout_sessions_parent_ownership on public.workout_sessions
as restrictive for all to authenticated
using (
  (select auth.uid()) = user_id
  and (plan_id is null or exists (
    select 1 from public.plans p
    where p.id = workout_sessions.plan_id and p.user_id = (select auth.uid())
  ))
)
with check (
  (select auth.uid()) = user_id
  and (plan_id is null or exists (
    select 1 from public.plans p
    where p.id = workout_sessions.plan_id and p.user_id = (select auth.uid())
  ))
);

drop policy if exists set_logs_parent_ownership on public.set_logs;
create policy set_logs_parent_ownership on public.set_logs
as restrictive for all to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.workout_sessions s
    where s.id = set_logs.session_id and s.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.workout_sessions s
    where s.id = set_logs.session_id and s.user_id = (select auth.uid())
  )
);
