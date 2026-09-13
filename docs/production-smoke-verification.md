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

## Verify published function metadata independently

A successful build, `ready` state, unchanged ZIP digest or public HTTP 200 alone is insufficient. During recovery, a ZIP-directory override lost invocation metadata while the function bytes stayed identical. The SSR adapter then returned an invalid Lambda response and the background/schedule metadata was incomplete.

After a canonical deployment, obtain fresh read-only `getSite` and `getDeploy` API results through the authorized connection. Project only the site ID and `published_deploy.id` for the site snapshot; never export environment values. Capture the deploy's `id`, `site_id`, `context`, `state`, `published_at`, `error_message`, `available_functions` and `function_schedules`. Read the site's published pointer again after collection; discard the snapshot if it changed. Save `{ "site": ..., "deploy": ... }` locally outside tracked source.

Run the offline checker with independently confirmed identifiers:

```sh
node scripts/verify-netlify-deployment.mjs snapshot.json <site-id> <deploy-id>
```

It requires the current published production deploy, ready state, valid publication time, one SSR streaming function with all-method catch-all routing and API v2, one API-v2 background worker, and one API-v2 scheduled dispatcher with `10 3 * * *`. Missing/duplicate entries or lost invocation metadata fail, even if the hashes are unchanged. The checker deliberately describes this specific GYMS.LIFE contract, not all possible Netlify configurations.

The checker is offline, prints bounded error codes only, and performs no deploy, rollback, secret operation, database query or job invocation. Success describes the captured metadata only: `executionVerified` and `codeIdentityVerified` remain false. It does not attest a Git SHA when Netlify reports `commit_ref: null`, nor prove configuration remains unchanged after capture. Use live smoke and durable worker receipts separately.

Regression command: `npx vitest run scripts/netlify-deployment.test.mjs`. These tests are also included in `npm test`.

For this project, do not override the functions directory with `.netlify/functions` ZIP output. Retain the standard production-context build and framework adapter's metadata; rebuild functions with `--skip-functions-cache` when needed. Do not manually rewrite bundle metadata to make a failing check pass.

## Integrated verification and guarded release

`npm run verify:production` now collects fresh site/deploy metadata using the already authenticated local Netlify CLI, runs the metadata checker and public HTTP smoke together, and re-reads the published pointer before and after smoke. It makes no deployment, secret, database or worker invocation. It returns nonzero on missing metadata, a changed published deploy, bad public responses or unavailable tooling. No raw API/CLI payload is printed.

The opt-in release entry point is:

```sh
npm run deploy:production -- --expected-sha <full-reviewed-main-SHA>
```

The exact 40-character SHA is mandatory. The wrapper checks the repository origin, clean tracked/untracked worktree, exact HEAD and remote `main`; runs typecheck, the full test suite and lint; rechecks source and the published pointer; and uses the canonical production build/deploy command. No caller-supplied function directory, `--no-build`, credential or target override is accepted. The build happens inside Netlify CLI's deploy lifecycle, preserving adapter metadata.

After publication it uses the returned deploy ID, checks it against the current site and function metadata, runs live smoke, then checks the published pointer again. A CLI timeout may still have published: the report retains `deploymentAttempted`, the previous deploy ID and a bounded error. Do not blindly retry or automatically restore a deployment over another operator's release. This is not an atomic cross-provider lock and cannot prevent all concurrent changes.

This wrapper supports the existing macOS/Linux CLI setup, requires the verified Netlify CLI **27.5.2** already installed/available to `npx --no-install`, and never downloads or upgrades it. Review a CLI version change before changing the version gate. Install application dependencies from the lockfile before use. Existing CLI authentication remains outside source control; no new secret is provisioned by this command.

These are local/operator release commands, not a new GitHub deployment workflow. Direct `netlify deploy` invocations remain possible and do not inherit this wrapper's gates. Post-publication checks detect failures; they do not guarantee a bad version could never briefly become public. Runtime code identity and real Night Lab execution remain explicitly unverified even when these checks pass.
