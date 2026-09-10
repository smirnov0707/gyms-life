# Preview runtime isolation and browser-preflight repair

Baseline: `380e40c374dbb9c86b51fec10e3fa2403f7d058f`, on the existing main-targeting PR #61. All previous foundation, offline and Night Lab changes remain in this candidate. This is not a production rollout or an authenticated workout acceptance result.

## Diagnose the localStorage failure without hiding it

The earlier preview preflight injected its locale initializer into every frame. A hosted preview can contain an opaque-origin sandboxed platform frame where localStorage is denied. The test's initializer itself therefore emitted a SecurityError even when the application's top-level login page rendered.

`initializePageLocale` now runs only when both the top-level window and the explicitly expected app origin match. It neither changes iframe sandbox permissions nor catches storage errors in the intended app document. No application storage or authentication behavior was changed to make this test green.

A real-browser reproducer provides three controls: the former unscoped initializer produces a storage error with a sandbox iframe; the corrected initializer keeps the top-level locale and produces no page error; deliberately denying top-level storage still produces a test-visible error. Unit tests also cover opaque/foreign/child windows and actual top-level write refusal. The production-page error assertions remain in place.

With only the corrected QA initializer, the same immutable `380e40c` preview then passed its actual login-page, downloaded-client target and public staging catalogue checks. This passed in local Chromium and WebKit; the macOS 13 Playwright WebKit distribution is frozen and is not claimed to represent the newest iPhone Safari. CI independently checks the installed Linux browser distributions. This supports the test-instrumentation diagnosis rather than claiming an unverified app-data fix. The preflight additionally restricts its target to an immutable deploy permalink, not an arbitrary suffix-matching host or mutable alias.

## Use runtime metadata for the worker address

The previous dispatcher used `process.env.URL`, which is the main-site address, not necessarily the current preview deployment. Build environment names such as `DEPLOY_URL` are not an adequate replacement for the function runtime metadata contract.

The scheduled entry now supplies its provider-owned second `Context` argument to `dispatchCurrentNightLab`. The authenticated framework route uses the same adapter with `getContext()` from the installed `@netlify/functions` SDK. The pure target validator accepts a well-formed deployment ID, site name, known hosted context and published state, then derives the exact immutable `https://<deploy-id>--<site-name>.netlify.app` origin. Incoming request URLs, Host headers, `site.url`, `URL` and build-only variables are not fallback sources.

Unknown/local contexts, malformed metadata, and a retired production deployment fail closed. An active production context must use the production Supabase origin; Deploy Previews and branch deploys must use the existing staging origin. The adapter reads the runtime environment through Netlify.env and validates that database boundary before reading or forwarding the cron credential. It does not copy production credentials or introduce a provider-specific intelligence layer: the adapter remains outside canonical Night Lab business logic.

The receiving background worker applies the same deployment/database rule after its existing authentication and method checks, before importing/invoking canonical work. Knowing a preview credential does not make a preview with a production database setting acceptable. The previous cron-secret rotation check is retained. A missing SDK request context, missing environment API, missing credential or database mismatch produces unavailability, never a fallback to the main site.

The transport receives an explicit validated origin, refuses malformed origins and credential whitespace, disables redirects and retains its timeout. HTTP 202 remains an acknowledgement of queueing only. These guards do not prove that a queued job completed or that its result is valid; the existing job/receipt ownership and stage checks remain necessary.

## Acceptance evidence and limits

The runtime tests use explicit synthetic context and transport replies to cover production/preview/branch isolation, malformed metadata, current-versus-retired deployment, database mismatch, absent runtime, and request/configuration rejection. The actual compiled function bundle is exercised too: a synthetic scheduler context targets its exact deployment; missing context does not dispatch; and an authorized synthetic worker call with the wrong database fails before any domain work. No real cron or database request is made by those bundle tests.

The existing Night Lab browser workflow now runs the real sandbox-frame reproducer in Chromium and WebKit and uploads its result alongside the morning/UI and bundle evidence. Expected-error controls are labelled as such; they are not zero-error app journeys. Exact-head CI results and real deployed-preview results are recorded separately in the final PR comment and handoff.

At the initial effective-config read in this block, Deploy Previews correctly targeted `yywnpovsqifwujuxdxog`, but their server-role credential and cron secret were still absent; `AI_ENABLED` also remained unset. Production still targeted `tqwqbjkjqzusohxdzupr`. No environment values, secrets, payment settings, database schema or real account records were modified during this repair. The earlier forbidden configuration-creation action was not retried through another identity or mechanism.

Consequently, a real authenticated test-account journey and a real Night Lab invocation remain blocked until an authorized operator supplies staging-only server/cron configuration securely and confirms the intended preview AI setting. A successful unauthenticated preview read is not a password login, RLS write, offline synchronization or completed background analysis. The wider production migration reconciliation, device and recommendation acceptance gates remain open. No production deploy or main merge is part of this block.

This adapter intentionally supports the current Netlify project with production and preview/branch contexts. A future dedicated staging site published in a production context, or a Cloudflare runtime, needs its own explicit approved environment mapping; it must not be made to work through silent fallback.

## Reproduction

Run `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build`, and `npm run test:bundle:night-lab`. `node scripts/test-browser-locale.mjs` reproduces the frame controls; `CORE_BROWSER_ENGINE=webkit` selects WebKit. Existing night/core/offline/auth/Today/Twin checks remain required.

`STAGING_ORIGIN`, `STAGING_PUBLISHABLE_KEY` and an optional `CORE_BROWSER_ENGINE` run `node scripts/test-staging-preview.mjs` against a known immutable preview. Only the staging public key belongs in that preflight process. Never provide a service-role key, never invoke a live worker as a substitute for configuration checks, and keep keys out of source and artifacts.

Primary runtime contracts: https://docs.netlify.com/build/functions/api/ and https://docs.netlify.com/build/functions/environment-variables/ .

## CI environment follow-up

On the first `5908f0e` attempt, browser jobs failed before executing application tests: the hosted runner's unrelated Google Chrome APT repository served a package index that did not match its declared hash. Unchanged-code targeted retries failed at dependency installation as well. Package signature/hash verification was not disabled or ignored, and those attempts are not counted as passed tests.

Browser jobs now use the official Microsoft Playwright image for the **existing locked Playwright version**, pinned to a verified registry manifest digest in `.github/playwright-image.json`. The manifest response body was hashed locally and compared with the registry's content-digest header. Its preinstalled browser libraries remove the dependency on the generic runner's additional APT repositories. `npm ci`, test commands, matrices, assertions and artifact handling remain; only the browser runtime provision step changes. Non-browser CI and geometry jobs keep their original runner setup.

A version check must match all three locked Playwright packages to the image and find the expected preinstalled Chromium/WebKit executables; mismatch is a failure, not an installation fallback. The image/version agreement has regression tests. Container approval does not itself count as application-test success: each existing suite must still execute and pass in that environment.

Primary supported container guidance: https://playwright.dev/docs/docker and https://playwright.dev/docs/ci .
