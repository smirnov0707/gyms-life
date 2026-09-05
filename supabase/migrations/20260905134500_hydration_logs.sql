-- Fluid intake as real, owned data instead of a per-device number.
--
-- Intake lived only in localStorage, keyed by user and day. That meant it
-- vanished when the browser was cleared, never followed the athlete to a
-- second device, and was invisible to everything else in the app — the
-- coach, the Lab and the Twin could not see a drop of it. The target was
-- computed from real logged data while the intake measured against it was
-- not persisted at all.
--
-- Entries are stored individually rather than as a daily total: when a
-- glass was drunk is part of hydration, and a total cannot be un-summed.

create table if not exists public.hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  -- The athlete's own calendar day, resolved in their timezone by the
  -- caller. A UTC date would move the boundary for anyone not on UTC.
  logged_on date not null,
  amount_ml integer not null check (amount_ml > 0 and amount_ml <= 3000),
  consumed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists hydration_logs_user_day_idx
  on public.hydration_logs using btree (user_id, logged_on desc);

alter table public.hydration_logs enable row level security;

-- `(select auth.uid())` rather than a bare call, so the planner evaluates it
-- once per statement instead of once per row (auth_rls_initplan).
drop policy if exists "Users manage own hydration logs" on public.hydration_logs;
create policy "Users manage own hydration logs"
  on public.hydration_logs for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.hydration_logs is
  'Individual fluid intake entries. One row per drink logged, in the athlete''s local calendar day.';
