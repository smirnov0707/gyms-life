# Staging acceptance: deployment isolation before test-account writes

> Historical record at `380e40c`. The subsequent initializer diagnosis, corrected preflight and trusted runtime dispatch implementation are documented in `PREVIEW_RUNTIME_REPAIR_20260909.md`. The missing secure configuration and genuine authenticated acceptance gates remain separate.

## Starting revision and completed checks

This continues PR #61 from `fa64637d04e25cc3c58e67a4c7dc13b057cb1407`. The two previously unfinished workflow groups were cancelled while installing Chromium, before their browser tests ran. Only those cancelled jobs were retried. Both finished successfully, so all nine workflow groups on `fa64637` are now successful. Earlier core, offline and Night Lab evidence remains retained.

## Live configuration finding

The connected Netlify account has one existing project, `singular-vacherin-57448d` (`0d17652b-c26c-4ada-9792-d332c7572536`), serving production at `gyms.life`. PR #61 already has an automatic Deploy Preview; its existence is not evidence that it uses an independent database.

The preview inherited production Supabase URLs, IDs and public keys from the `all` context. Its `SUPABASE_SERVICE_ROLE_KEY` was empty. A test login against those inherited public settings could have targeted the production account system even though server-only operations failed. No test account was created and no authenticated action was attempted under that configuration.

Only the **deploy-preview** values of these six existing variables were changed to the existing staging project `yywnpovsqifwujuxdxog`:

- `SUPABASE_URL` and `VITE_SUPABASE_URL`.
- `SUPABASE_PROJECT_ID` and `VITE_SUPABASE_PROJECT_ID`.
- `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

The original scopes were retained. Effective production URL and project-ID values were read back and remained `tqwqbjkjqzusohxdzupr`. No production branch, schema or deployment was changed. Environment changes affect a subsequent preview build, not previously deployed immutable previews.

`AI_ENABLED=false` was requested for Deploy Previews only; its effective read-back is recorded separately, because a successful configuration API response is not proof that a newly created setting exists. Production AI settings were not disabled. No real provider request is part of this preflight.

## Missing prerequisites and the dispatcher issue

The staging server-role credential is still required for the existing app's server-owned writes and for proper admin creation of isolated test identities. No existing service-role secret was extracted, copied from production, or placed in source. The Supabase CLI installation did not complete within the bounded attempt and was stopped; it is not a verified authenticated administration path.

A second deployment issue remains open: `URL` in a Netlify function identifies the main site. `CONTEXT`, `DEPLOY_URL` and `DEPLOY_ID` are build variables, not the guaranteed function-runtime metadata contract. A preview dispatcher must obtain its exact deployment from the provider's request `Context` rather than guessing or accepting an inbound Host header. The planned runtime adapter change was blocked by the execution tool; its incomplete experiment was rolled back and is **not part of this delivery**. No preview-to-production dispatch was attempted.

## Real deployed preflight

`scripts/test-staging-preview.mjs` opens the actual preview login page in a fresh isolated browser context, observes the downloaded client modules, rejects any attempted request to production, and checks the public staging exercise catalogue. It uses no synthetic server responses and creates no account. It records the tested origin, browser, public-target assertions and a screenshot, without persisting keys.

The script is intentionally narrower than the full acceptance journey. A successful login-page render or public catalogue read does **not** validate authentication, session ownership, offline delivery, a saved workout, the background dispatcher or a completed Night Lab report.

Example invocation, with a public key supplied outside the repository:

```sh
STAGING_ORIGIN=https://<deploy-id>--singular-vacherin-57448d.netlify.app \
STAGING_PUBLISHABLE_KEY=<staging-public-key> \
node scripts/test-staging-preview.mjs
```

Use `CORE_BROWSER_ENGINE=webkit` for the second browser engine. Never provide a service-role or secret key to this public preflight. Test results are written only to ignored `test-results/staging-preview/`.

## Acceptance remains blocked until configured

A proper test identity must be created through the authenticated staging admin API, with a unique run marker and no email delivery to a real person. Its ordinary browser login, training execution, offline recovery and report reads must use actual application endpoints and actual RLS. Do not replace this with direct SQL insertion of an authenticated session or mocked acknowledgement and call it accepted.

The next live prerequisite is the **staging project's** `SUPABASE_SERVICE_ROLE_KEY` in Netlify's **Deploy Previews** context and **Functions** scope. It must be entered through the environment settings, not sent in chat or committed. Production credentials/settings remain unchanged. A matching non-production cron credential and the verified runtime dispatch target are also needed before invoking background work.

The broader production migration reconciliation, genuine device tests and final product acceptance are still open. This block does not enable payments or publish the integration candidate to production.

## Primary platform contracts

- https://docs.netlify.com/deploy/deploy-types/deploy-previews/
- https://docs.netlify.com/build/functions/environment-variables/
- https://docs.netlify.com/build/functions/api/
- https://supabase.com/docs/reference/javascript/auth-admin-createuser

Exact effective-config read-back and the real preview result are recorded in the PR completion note and `work/continuation-20260909-staging-acceptance/`; the script's presence alone is not a pass.

### Configuration write verification

Effective read-back confirmed the six staging public-variable overrides and unchanged production database identities. Creating the new `AI_ENABLED` entry did not persist despite an initial success message. The official create-variable API subsequently returned **Forbidden**. No further creation attempt or alternative-credential workaround was made. Therefore AI is **not claimed to be disabled** in previews; setting this new preview-only variable requires an authorized account action. This unauthenticated preflight does not call any AI route regardless.
