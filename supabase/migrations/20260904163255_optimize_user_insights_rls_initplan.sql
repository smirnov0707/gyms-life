-- Performance advisor fix: avoid re-evaluating auth.uid() per row.
-- Same (select auth.uid()) pattern already used correctly by the
-- personal_timeline_select_own policy.

drop policy if exists user_insights_select_own on public.user_insights;
create policy user_insights_select_own
on public.user_insights
for select
to authenticated
using ((select auth.uid()) = user_id);
