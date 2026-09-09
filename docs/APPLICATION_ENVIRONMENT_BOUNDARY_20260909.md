# Application environment boundary after the authorized restore

## Scope and retained state

Baseline: `2998b6bd2434d5686926d8c2a32a8348e3259f01`, on the existing main-targeting PR #61. At the start of this block, read-only hosting metadata confirmed the authorized production restoration remained in place: main domain deploy `6aa0dead486fbc00088640d7`, production commit `6203140`. Staging server-role and cron configuration were still absent. No private account, authenticated workflow, live AI or background job was attempted to get around that missing configuration.

The earlier restore corrected the published-deployment pointer. It did not add an application-level safeguard if somebody later publishes a preview again. The existing Night Lab guard protects its worker, but it did not guard the public application, browser login client or other server actions. This block adds that missing application boundary to new builds without changing the host's publication policy or production deployment.

## Three independent boundaries

**Build:** the supported hosted Netlify build must declare a known deployment context, the expected existing site ID/name, a full source revision, and matching server/browser Supabase URLs and public project IDs. Production builds use the production project; Deploy Previews and branch builds use staging. An inherited production value cannot build a staging application. Public keys are structurally checked and service-role/secret keys are rejected from the browser field. Opaque public-key ownership cannot be proved from the key text, and decoding a legacy JWT is not signature verification; real credentials/RLS still require their own acceptance tests.

Only validated non-secret build metadata is embedded in client and server bundles. The mapping of both production/staging project IDs lives in the build-time module; a staging browser bundle does not receive the production project constant from that mapping. No secret or value contents are echoed in build errors. Local unmanaged builds are marked local, not promoted to a hosted production identity. The current older Cloudflare-staging prototype has no approved runtime adapter for this guard; it cannot be presented as a supported hosted Netlify release through fallback.

**Server:** the top-level server entry checks build identity, actual Netlify SDK runtime context, site identity, publication state, allowed request origin and server database origin **before** lazily importing the framework/dispatching actions. Request host information restricts the request; it cannot select a different data project. Published-preview code is blocked, including when accessed at its immutable URL. Production-facing domains reject staging regardless of the publication flag. Missing or contradictory runtime metadata fails closed. An unverified locally built artifact cannot masquerade as a release merely by changing an incoming URL.

A mismatch returns HTTP 503 with no-store/noindex headers. HTML errors contain no form or application bootstrap script and state that local workout records are unchanged. API requests receive a stable error code, not raw configuration or secrets. The common security-header layer now intersects its default Content Security Policy with an explicitly stricter route policy rather than replacing it. A production/standalone-preview request whose build and runtime agree still reaches the ordinary application.

**Client:** the actual lazy Supabase adapter checks the compiled metadata, browser origin and configured public project before initializing the SDK or reading its stored auth session. It checks again before each outgoing SDK request. This prevents a newly guarded staging bundle cached or served on the main domain from contacting staging as though it were production. It does not read/delete/rename local pending-workout or legacy storage to hide the problem. The SDK's auth/session behavior and explicit expected-owner checks from previous work remain intact.

## Read-only environment metadata

`GET /api/public/environment` returns a small uncached report: build target, build context, source commit, compatibility status and stable issue code. It does not load the framework or issue a database request. It returns 200 for compatible configuration and 503 for a blocked environment. `scope` explicitly says this is deployment identity, **not** database authentication, RLS or application acceptance. Server-role/cron keys and any hashes of them are never exposed.

The existing live preview preflight now requires `STAGING_EXPECTED_COMMIT` and checks this actual runtime report before inspecting the public login page/modules/catalogue. An old successful preview or incorrect revision therefore cannot stand in for the current candidate. Its browser still aborts any production-origin request; its old raw-storage-error assertions remain. The CLI parameters are public staging origin/key plus a full expected commit; no test account is created.

## Evidence and controls

Unit tests cover build-context inheritance, public-key misuse, wrong site/revision, production/preview/branch hosts, malformed origins, runtime/site/database mismatches, unexpected publication and no-secret diagnostics. The actual lazy Supabase adapter is tested with an instrumented SDK to prove it refuses a bad domain before storage/SDK/network access, and continues to guard an already-created fetch. These tests use synthetic keys, not real authenticated sessions.

A real HTTP/browser harness bundles the actual server guard and supplies explicit synthetic provider metadata. It tests compatible production/preview responses, accidental preview publication, wrong database, missing runtime and diagnostic responses. In blocked cases the lazy handler is never called, no login form is rendered, local queue/session seed bytes remain unchanged, and the 320px error page makes no external request. The test never changes a live publication to simulate a failure. Both browser engines run in the existing pinned CI environment.

Read-only checks of the new immutable preview and the restored main-domain target are recorded separately after deployment. They do not count as full account/workout/Night Lab acceptance. No environment write, secret creation, database migration, payment operation, main merge, production publish or automatic-publish-policy change is included in this block.

## Limitations and release sequence

This protects newly built guarded artifacts. Publishing an older unguarded preview or running a tab with old code does not gain this protection retroactively. Browser/storage isolation is not encryption against same-origin script execution or developer tools. Unknown future providers/sites/domains require an explicitly reviewed adapter rather than widening hostname checks until they happen to pass.

A genuine staging account/device workout and background-review journey is still blocked by missing secure server/cron configuration. Do not treat the new compatibility report as proof those services are configured. The preceding production schema reconciliation, model/meal quality and visual acceptance gates remain. Keep PR #61 draft and the newer build in its standalone preview until they pass.

Commands: `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build`, `node scripts/test-application-environment.mjs`. CI runs the guard's browser controls in Chromium and WebKit. Run the live public preflight with `STAGING_ORIGIN`, `STAGING_PUBLISHABLE_KEY` and `STAGING_EXPECTED_COMMIT`.

Primary provider metadata contract: https://docs.netlify.com/build/functions/api/
Build-context inheritance: https://docs.netlify.com/deploy/deploy-overview/
