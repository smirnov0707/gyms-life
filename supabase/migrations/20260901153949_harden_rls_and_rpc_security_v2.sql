-- Keep the migration repository aligned with the production hardening applied
-- on 2026-09-01. All application-owned rows are isolated by auth.uid().

alter table public.ai_usage_daily enable row level security;
drop policy if exists "Users read own ai usage" on public.ai_usage_daily;
create policy "Users read own ai usage" on public.ai_usage_daily for select to authenticated
  using ((select auth.uid()) = user_id);

alter table public.body_metrics enable row level security;
drop policy if exists "own metrics" on public.body_metrics;
create policy "own metrics" on public.body_metrics for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.coach_messages enable row level security;
drop policy if exists "Users manage their own coach messages" on public.coach_messages;
create policy "Users manage their own coach messages" on public.coach_messages for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.daily_checkins enable row level security;
drop policy if exists "own checkins" on public.daily_checkins;
create policy "own checkins" on public.daily_checkins for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.exercises enable row level security;
drop policy if exists "exercises readable" on public.exercises;
create policy "exercises readable" on public.exercises for select to anon, authenticated using (true);

alter table public.form_analyses enable row level security;
drop policy if exists "own form analyses" on public.form_analyses;
create policy "own form analyses" on public.form_analyses for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.health_samples enable row level security;
drop policy if exists "own health samples" on public.health_samples;
create policy "own health samples" on public.health_samples for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.meal_plans enable row level security;
drop policy if exists "own meal plans" on public.meal_plans;
create policy "own meal plans" on public.meal_plans for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.nutrition_logs enable row level security;
drop policy if exists "Users manage own nutrition logs" on public.nutrition_logs;
create policy "Users manage own nutrition logs" on public.nutrition_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.plans enable row level security;
drop policy if exists "own plans" on public.plans;
create policy "own plans" on public.plans for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

alter table public.set_logs enable row level security;
drop policy if exists "own sets" on public.set_logs;
create policy "own sets" on public.set_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.subscriptions enable row level security;
drop policy if exists "Service role can manage subscriptions" on public.subscriptions;
create policy "Service role can manage subscriptions" on public.subscriptions for all to service_role
  using (true) with check (true);
drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription" on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

alter table public.supplements enable row level security;
drop policy if exists "own supplements" on public.supplements;
create policy "own supplements" on public.supplements for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.user_memory enable row level security;
drop policy if exists "Users read own memory" on public.user_memory;
create policy "Users read own memory" on public.user_memory for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Users delete own memory" on public.user_memory;
create policy "Users delete own memory" on public.user_memory for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.user_roles enable row level security;
drop policy if exists "Users read own roles" on public.user_roles;
create policy "Users read own roles" on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id);

alter table public.vbt_logs enable row level security;
drop policy if exists "own vbt logs" on public.vbt_logs;
create policy "own vbt logs" on public.vbt_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.vision_meal_scans enable row level security;
drop policy if exists "own vision meal scans" on public.vision_meal_scans;
create policy "own vision meal scans" on public.vision_meal_scans for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.workout_sessions enable row level security;
drop policy if exists "own sessions" on public.workout_sessions;
create policy "own sessions" on public.workout_sessions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
