# Authentication and payment acceptance — continuation of PR #56

Base: `6466869c52b50be6c22982a2e3fa960c2ccf9d1c` on the existing core audit branch. This work lives in a separate stacked branch, `codex/core-provider-billing-20260909`. It neither replaces the parent worktree nor deploys production.

## Authentication defects repaired

A sign-up response without a session previously led to polling and unconditional navigation into the app. It now has an explicit email-confirmation state; an accepted sign-up is not described as a successful sign-in. Immediate-session registration and sign-in navigate only after the session is available. Form and OAuth actions share a synchronous duplicate-request guard. Dead post-OAuth code was removed.

Post-authentication redirects are normalized against a fixed same-origin base. Literal/encoded backslashes, control characters, external protocol-relative URLs, malformed encodings and cyclic auth/reset destinations are rejected. This closes the browser-normalization case that a `startsWith('/')` test did not cover.

The actual AuthProvider now uses a revision-ordered controller for initial, focus and visibility session reads. An older asynchronous read cannot resurrect an identity after a newer sign-out. Read failures are caught and do not manufacture a new sign-out. Identity-scoped query state is cleared before publishing the replacement identity. The obsolete error-check allowlist entry for AuthProvider was removed.

Password reset shows a loading or missing/expired-session explanation until an authenticated session is present. Mismatch and repeated submits cannot trigger multiple password changes; success requires an actual returned user. This does not certify delivery of a recovery email or an external OAuth callback.

## Payment defects repaired

The old webhook inserted a claim before applying the subscription, and could acknowledge an update affecting no row. Process interruption or an unsuccessful claim cleanup could therefore suppress all retries. Recognized subscription events now call one database function that persists the subscription snapshot and completed receipt in a single transaction. A failed state write cannot leave a completed receipt.

Created/updated/activated/trialing/past-due/paused/resumed/canceled snapshots share one normalized contract. Native Paddle price/product IDs work without optional migration/import metadata. Unrecognized or malformed product/owner data is not silently converted into a paid subscription. Unknown signed event families are explicitly ignored; recognized-but-invalid events are rejected without a completed receipt.

The receipt ledger keys by environment and event ID. Per-subscription transaction locks serialize first arrival and later updates. Older or equal `occurred_at` values cannot overwrite a newer saved state; equal timestamps deliberately retain the first accepted state rather than inventing an ordering. A newer cancellation cannot be overwritten by an older creation event. Conflicting owners, customers, environments and event identities are rejected. The old `paddle_webhook_events` log is retained and not mistaken for successfully processed receipts.

Management actions validate server-side billing enablement, environment and allowed plan keys. Subscription lookups are scoped to the current owner and the configured environment. Cancel/resume mirror writes use an optimistic revision and require a returned row; a zero-row update reports `synced: false`. Typed SDK options replace the previous forced casts.

Price lookup no longer uses an unsupported `external_id` list filter or accepts the first returned price. It either reads an explicitly configured native ID or exhaustively matches the imported key through bounded same-origin pagination. The resulting active recurring price must match the application's displayed base currency, amount and billing interval. Another product on the same Paddle account cannot grant app access merely by carrying a user ID.

Webhook bodies are bounded before SDK parsing. Actual SDK HMAC tests verify original raw bytes, tamper rejection, stale signatures, missing signatures and the body limit. Webhook and gateway failures log stable application codes rather than raw provider response text.

## Staging database evidence

Migration `20260909090917_atomic_paddle_receipts.sql` was applied only to `gyms-life-staging` (`yywnpovsqifwujuxdxog`). The repository filename matches the migration history returned by staging. New receipt/RPC and subscription watermark type definitions were copied from Supabase's regenerated staging contract; unrelated generated types were retained.

A real PostgreSQL transaction with newly generated synthetic identifiers passed 12 assertions: an update arriving before creation, duplicate receipt, rejection of stale resurrection after cancellation, recovery despite an old incomplete claim, full price/cancellation field updates, preserving the existing owner when later metadata omits it, environment and owner isolation, no receipt after a failed foreign-key write, retrying that same event successfully, event identity collision rejection, and denial of client RPC/receipt grants. The transaction ended with `ROLLBACK`; no subscription, receipt or test-account row from that probe remains. No Paddle network transaction or charge was executed by these SQL tests.

## Deployment configuration and unresolved acceptance gates

Do not enable billing simply because controlled tests pass. Apply the migration before deploying the new webhook. Keep the old log for investigation, configure an environment-consistent client token and server key, and verify `PADDLE_ENVIRONMENT` matches that token. The preferred `PADDLE_PRICE_MAP` is a server-only JSON object mapping `sandbox`/`live` and `vex_weekly`/`vex_monthly`/`vex_yearly` to their real native price IDs. Without it, only uniquely matching imported app keys are accepted. `.env.example` documents the shape without real credentials.

The displayed base prices are the existing EUR 3 weekly, EUR 12 monthly and EUR 49 yearly amounts; taxes, actual checkout display, discounts, invoices and refund policy remain a real sandbox acceptance check. The proration mode defers the plan-change charge to renewal; it must not be represented as independently validated refund, entitlement or cancellation policy.

No production migration, app deployment, real payment, refund, real account password change, email delivery or OAuth-provider interaction was performed. A proposed temporary staging password-login fixture was blocked before account creation, so the password network journey remains unverified. The checked auth paths use real app components and the actual AuthProvider with explicit synthetic Supabase responses.

The prior sport/meal fixes remain in the parent branch and its test suite. This block does not implement a medical/allergen certification, does not alter nutrition formulas, and does not claim that real AI meal output is always correct. Actual provider response evaluation, allergen/recipe suitability, authenticated start-to-finish workout execution, device integrations, production schema rollout, and the parent visual acceptance gate remain separate work.

## Reference contracts and repeatable local checks

- Supabase sign-up session/confirmation behavior: https://supabase.com/docs/reference/javascript/auth-signup
- Supabase authenticated password-update flow: https://supabase.com/docs/guides/auth/passwords
- Paddle retries and out-of-order delivery: https://developer.paddle.com/webhooks/about/how-webhooks-work/
- Paddle price-list query and nullable import metadata: https://developer.paddle.com/api-reference/prices/list-prices/
- Paddle subscription update/proration: https://developer.paddle.com/api-reference/subscriptions/update-subscription/

Run `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build` and `npm run test:browser:auth`. `CORE_BROWSER_ENGINE=webkit` runs the same auth browser suite with WebKit; the CI workflow executes both engines. The focused HMAC tests run locally without provider credentials or network access. The PR completion comment must identify the exact commit and final evidence, not an earlier run.

The post-migration staging security advisor reports four informational RLS-without-policy notices, including the new receipt table. The table is deliberately server-only: browser grants and function execution are revoked, and the transactional regression checks those restrictions. No client policy was added merely to suppress the notice. Advisory reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

The rollback-only SQL reproduction is retained at `tests/billing/atomic-receipts.rollback.sql`. Supabase type-file normalization was compared as a TypeScript AST so the final change preserves the existing generated-file formatting and adds only the new contract fields.
