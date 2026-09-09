# Future Lab foundation integration — first implementation block after the vision audit

## Scope and canonical lineage

This is a **single integration candidate**, not a production deployment. It starts from the latest reviewed AI/plan chain, `13d7411958d69e318892b2b6efc5db54ba24591e`, and preserves the actual parent histories of:

- `main` at `6203140c9dbd1958ab8c6fb83fc0d641a4015306` (athlete-facing errors and storage refusal handling).
- Availability guard PR #54 at `33e0a578456fbf73b16afcf59ed1b4896044e1e4` (including `3401250`).
- The audit chain through PR #60, including earlier training, nutrition, auth, AI and visual work.

The separate #57 review branch was compared with #56, not merged wholesale. Its one isolated extra meal-profile regression file is retained. Its changes that delete the parent-ownership migration/documentation or reduce the browser matrix are deliberately not imported. The original branches and worktrees remain untouched.

The `main` merge had two conflicts in the offline workout logging branches. Each was resolved by keeping **both** the actionable `queueSetOnThisDevice` wrapper from production and the `{ recorded: input }` acknowledgement used by the audited workout progress state. Taking either whole side would discard a different fix. Merge-sensitive browser tests cover these exact paths.

## Source completeness before persistent history or learning

The integrated guard classifies every declared source state explicitly. The former `_data_unavailable` suffix test missed `body_measurements_unavailable` and `current_context_unavailable`. It also failed to propagate separate workout-response and decision-feedback read errors all the way to persistence.

The complete nine-source map now survives aggregation; unreadable or consent-restricted sources do not create a canonical snapshot, derived memory or a persisted Today decision. A legitimately readable empty history still permits the normal new-athlete onboarding decision. A new unclassified gap cannot silently pass the TypeScript contract or schema decoding.

The retained integration tests exercise each failure through the real snapshot/Today service boundaries with mocked source reads. An additional truth-table check covers **all 512 combinations** of the nine availability flags; this is one exhaustive test, not 512 independent live scenarios. Consent and unknown-gap cases are tested separately. No historical athlete snapshots or memory rows were rewritten.

## Read-only staging/production comparison and a new staging correction

`foundation-schema-probe.sql` inspects actual signatures, return types, execution grants, RLS flags, parent-policy definitions and recent migration history. It contains no DDL or data mutation. `foundation-schema-check.mjs` consumes the returned JSON and fails closed on missing or invalid prerequisites. Its `compatible` result means **only that this limited core schema gate passed**, never that the product is ready to publish. Definitions and behavioural tests still require review.

At 2026-09-09 13:36 UTC, the production query found three blockers:

1. The `commit_generated_meal_plan(uuid,timestamptz,jsonb,jsonb,text)` routine used by the audited meal generator is absent.
2. `workout_sessions_parent_ownership` is absent.
3. `set_logs_parent_ownership` is absent.

Blindly deploying the app over that schema could break meal-plan saves and would omit the reviewed parent-reference protections. Production remained read-only during this block.

The same preflight found an additional staging mismatch: the old activation routines had anonymous EXECUTE grants, although their invoker bodies already check `auth.uid()` and reject unauthenticated use. This is unnecessary privilege, **not proof that unauthenticated activation succeeded**. New forward-only migration `20260909133708_normalize_core_function_execute_grants.sql` removes anonymous/public grants and retains authenticated/service execution for the three core routines. It was applied **only to staging**. No user rows, function bodies, payment tables, or migration history entries were rewritten.

A follow-up query confirmed unchanged function body fingerprints and the intended grants. A rolled-back, no-row-created staging transaction also verified three anonymous calls fail at function privileges while the authenticated role retains execution and the inner no-session authentication guard. The staging preflight at 13:39 UTC is compatible; the recorded production preflight is blocked. The generated-type contract did not change, since function signatures and data columns did not change.

### Migration ordering, without blindly replaying history

The release candidate includes these non-payment prerequisites in sequence:

- `20260909082851_workout_parent_ownership.sql`.
- `20260909103954_commit_meal_plan_atomically.sql` followed immediately, in the same controlled migration batch, by `20260909104041_fix_meal_commit_variable_names.sql`.
- `20260909133708_normalize_core_function_execute_grants.sql`, after the meal routine exists.

The initial/fix meal migrations remain in history as already applied to staging. Do not drop the follow-up, squash staging history in place, or deploy between those two steps. Existing SQL and the previously retained rolled-back owner/isolation/meal-commit tests must be executed against the eventual release target before switching the application.

Older migration names have different recorded timestamps in local/staging/production histories. For example, `service_role_sink_comments`, `background_job_runs` and `timeline_upsert_conflict_target` are present under three sets of timestamps. Names/timestamps alone are not proof that DDL is missing or semantically identical. Preserve the current ledgers, compare definitions, and prepare a reviewed forward reconciliation rather than bulk `db push`, `migration repair`, renaming applied rows or blindly rerunning older files.

Billing remains deferred. Earlier billing code/migration files in the parent audit are preserved byte-for-byte; no billing setup, activation, new migration, live charge or refund is included here. An eventual rollout must separately determine whether its billing paths remain disabled and satisfy their own schema contract before they are reachable.

## Actual browser-offline defect found during integration

The new browser tests switched the browser itself offline after a workout started. They exposed a defect that simulated network-error responses did not: TanStack Query's default online-only mutation mode paused `logMutation` before its existing local-storage branch ran. No offline set was written and the action could remain waiting for a future reconnect.

The set operation now explicitly runs with `networkMode: "always"` and no automatic retries, because it owns its durable offline branch. Start and finish also execute their own connectivity guards immediately: an unavailable start/finish returns a localized reconnect instruction and clears the action lock instead of leaving a deferred mutation to execute later. This does not enable creating a new server session offline. The relevant official interface is https://tanstack.com/query/latest/docs/framework/react/guides/network-mode .

Both merge-conflict paths are tested: browser offline before submission, and a network failure after an online submission. The recorded-set acknowledgement is retained in each. Capacity/full-storage refusals preserve the existing synthetic queue and show the production-authored error in the correct language. Earlier generic tests that injected text into an HTML numeric field were replaced with the actual queue/refusal scenarios, not a weakened offline assertion.

## Offline and true-user acceptance: explicitly NOT closed by the merge

The current local queue still uses `gyms_life_offline_queue_v2` and contains session IDs but no owning-account field. The global sync component has no explicit identity-scoped store argument. Existing server ownership checks help protect writes, but do not establish local-device data isolation. This block preserves the raw queue and its production storage-error fixes; it does not silently assign legacy records to whichever person next signs in or delete old entries to make an upgrade look clean.

Next block acceptance must include A offline → sign out → B sign in → return to A, in-flight identity changes, two tabs, acknowledged-only removal, unknown legacy ownership, corrupt data and full/refused storage. Legacy rows must be retained and verified against owned server sessions before any automatic adoption. Test fixtures must never be mistaken for a real two-account/device acceptance run.

Additional remaining gates are actual AI/provider quality, live authentication delivery, multi-stage hosting budgets, the production Night Lab execution trace and final visual acceptance. The foundation step is to protect the learning inputs and establish one code lineage, not to claim that the full autonomous laboratory is now deployed.

## Repeatable checks and delivery boundary

Run `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build` and `npm run test:browser:core`. Core browser CI runs in Chromium and WebKit; the new integration helper is included in its path filters. The failure/queue tests use real app components with synthetic server records, while the browser itself is placed offline for the relevant actions.

For schema inspection, execute `scripts/foundation-schema-probe.sql` through the authorized read-only Supabase connection, save its `foundation_preflight` object as JSON, then run:

```sh
node scripts/foundation-schema-check.mjs /absolute/path/to/preflight.json
```

Exit 0 means the limited schema prerequisites match; 1 means a detected blocker; 2 means an unreadable/invalid input file. No migrations are executed by this command. Always regenerate the probe near deployment time instead of trusting this dated observation.

Exact merged-commit test counts, workflow run IDs and artifact results are recorded in the PR completion comment and local `work/continuation-20260909-foundation/` handoff. Keep the integration PR draft until the remaining rollout gates pass. No `main` push, production deployment or production DB write was performed in this block.
