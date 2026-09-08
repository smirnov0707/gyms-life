-- Why two tables have RLS on and no policies.
--
-- Supabase's database linter reports `rls_enabled_no_policy` for both of these
-- on every run, at INFO. It is not a finding: for a table no client may ever
-- touch, RLS enabled with no policy is the configuration, not a gap in it. A
-- policy is a grant, and neither of these tables has anyone to grant anything
-- to.
--
-- This is written into the schema because the obvious way to make the linter
-- quiet is to add a policy, and that would be the change that opens them.

comment on table public.app_observability_events is
  'Write-only sink for app observability events. Written by the service role in '
  'src/lib/observability.server.ts and read by nobody through the API. RLS is '
  'enabled with no policies on purpose: no client role has any access, which is '
  'exactly the intent. The linter''s rls_enabled_no_policy INFO on this table is '
  'expected — do not silence it by adding a policy.';

comment on table public.paddle_webhook_events is
  'Idempotency ledger for Paddle webhooks: one row per event id, claimed by a '
  'unique-violation race in src/routes/api/public/payments/webhook.ts. Written '
  'by a service-role client and never by a browser. RLS is enabled with no '
  'policies on purpose, and here it guards the money path — every row is the '
  'proof that a payment event was already handled. The linter''s '
  'rls_enabled_no_policy INFO on this table is expected — do not silence it by '
  'adding a policy.';
