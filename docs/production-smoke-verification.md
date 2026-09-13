# Production smoke and Night Lab verification

Run `npm run smoke:production` for public HTTP checks. Set `GYMSLIFE_SMOKE_BASE_URL` to test another deployment, and optionally `GYMSLIFE_SMOKE_TIMEOUT_MS` (1–120000 ms).

The check intentionally sends no Authorization or Cookie headers. It never calls the background worker URL. The only POST is an unauthenticated empty JSON request to `/api/internal/night-lab`.

## What passes

The seven page routes must return branded HTML without the environment-safety error. The scheduled function's public URL must deny access. The synchronous dispatch route must return the application's `401 Unauthorized` response, not an HTML fallback, redirect, `202`, or configuration error.

A missing production cron secret currently produces `500 Server configuration error`; the smoke check must fail in this case even if every page and the scheduled function's public guard pass. Failures emit bounded classifications, not remote response bodies or arbitrary transport messages.

## What this does not prove

A passed smoke check does not prove an overnight job ran. The report always has `executionVerified: false`. A background HTTP 202 only confirms invocation acceptance; inspect durable results separately.

To verify actual Night Lab execution, first confirm that the production secret exists with the required Functions scope, deploy the production-context bundles, and confirm the schedule and worker are present. Invoke only through an approved authenticated channel, then inspect `background_job_runs` and owner-scoped `night_lab_reviews`. Check run status, finished time, attempted/succeeded/failed counts, receipt contents and retry idempotency. Zero eligible athletes can legitimately produce no athlete receipts, but must never be described as learning about a user.

Do not put secret values in source, logs or chat. Do not bypass an auth/configuration failure or insert synthetic success into production ledgers. Payments are outside this verification workflow.

## Regression tests

Run `npx vitest run scripts/production-smoke.test.mjs`. The same tests are included in `npm test`. They use synthetic transports; no live credentials, user data or job execution are needed.
