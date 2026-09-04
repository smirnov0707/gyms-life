-- Future Lab Phase 1: make user intelligence readable by its owner without allowing client mutation.
-- Internal observability and Paddle webhook tables remain server-only by design.

revoke all on table public.user_insights from anon;
revoke insert, update, delete, truncate, references, trigger on table public.user_insights from authenticated;
grant select on table public.user_insights to authenticated;

drop policy if exists user_insights_select_own on public.user_insights;
create policy user_insights_select_own
on public.user_insights
for select
to authenticated
using (auth.uid() = user_id);

comment on table public.user_insights is 'Server-maintained personal intelligence. Authenticated users may read only their own rows; client mutation is intentionally denied.';
comment on table public.app_observability_events is 'Private server observability. RLS has no client policies intentionally; writes/reads are server-side only.';
comment on table public.paddle_webhook_events is 'Private Paddle webhook idempotency ledger. RLS has no client policies intentionally; server-side only.';
