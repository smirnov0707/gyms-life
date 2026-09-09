# GYMS.LIFE functional audit — core workflow repair

## Scope and release boundary

Isolated branch: `codex/app-functional-audit-20260909`, based on `9e76551d4af44b314a2b6fb7d4df82a34b2d2a19` (the existing Future Lab draft branch). This is not a production release or a certification that every external service is available or every AI result is correct.

`APP_FUNCTIONAL_INVENTORY.json` maps **33 file-route declarations, 62 server-function modules and 93 declared server functions**. It is a static inventory, not a claim that every action was executed. API handlers and authentication infrastructure also need their own integration checks. Existing user data, production assets, the original reference-UI worktree and `main` have not been overwritten.

## Removed misleading functionality

| Removed surface                         | What the code actually did                                                                                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dynamic TDEE calculator                 | Displayed constants: 2730 kcal expenditure, 2380 kcal intake and −0.35 kg weekly change. Its adapt button changed only local state to 2250 kcal while claiming the nutrition plan was updated. |
| Universal fasting/refeed window         | Displayed the same clock intervals for every person, without consulting workout completion or meal records.                                                                                    |
| Automatic photo-to-goal onboarding step | Copied inferred body values into ordinary profile fields and automatically selected a goal. The optional body-analysis features elsewhere are not deleted by this change.                      |

The two mock components and their now-unused translation keys were removed. No food, workout, measurement or account record was deleted. Existing advanced features were not removed merely because they need a device/provider test.

## Training changes

The quick questionnaire now exposes equipment and restores the saved profile and limitations. Shared input validation rejects malformed numbers, supports decimal commas and keeps missing body values unknown. The catalog can no longer widen to equipment the athlete does not own simply to fill the exercise count. Exact exercise aliases are normalized without resurrecting ambiguous names.

AI-generated programmes must pass the existing domain schema; omitted prescriptions no longer become invented defaults. The requested duration is checked against the declared duration and a conservative lower bound from rest periods. This lower-bound check is not a prediction of an individual's exact workout time.

Activation refreshes dependent query caches, prevents repeated UI clicks and checks owned stored programme data. An unfinished workout from a different programme blocks normal UI activation. Saved inactive programmes can be recovered from Training after a reload or failed activation, rather than forcing another paid generation. The current programme is not deleted when a saved programme is activated.

**Concurrency limit:** the new unfinished-workout check is an application precheck before the existing atomic activation RPC. It is not a new database lock shared with session creation; a true two-client activation/start race remains a release-gate test. Existing workout execution/snapshot/Finish/History rules are preserved, not claimed newly certified end to end.

An in-progress workout now resolves the immutable execution snapshot saved with its own session, rather than requiring whichever programme is active today. Older sessions resolve their original owner-scoped programme. Logging and completion use this shared resolver, so a changed or removed old plan does not invalidate a valid saved execution snapshot. Existing set validation, authenticated ownership, finish idempotency and replay rules remain. Six resolver tests cover the snapshot, legacy, failed-read and mismatched-day cases.

## Meal planning and food records

Saved diet/allergies/dislikes are restored before a generation can run. Failed reads no longer enable a blank replacement form or masquerade as no plan. Generation and adaptation share a UI lock. The second half of a generated week receives the first half's energy/macro targets; required recipe fields no longer receive generic numeric defaults. Accepted daily totals are reconciled to actual meal sums, then target/range checks run again.

Adaptation checks the advertised 15% target-change bound in code and preserves the original language for untouched days. It receives the displayed plan ID, revision and time zone, and saves only if owner, active state and revision still match. Missing food entries are not treated as proof of skipped meals. Translation cache writes are revision-guarded; stale results cannot overwrite a newer adaptation, and an unavailable translation is identified as such while the original is shown.

The food diary reads the selected local day with explicit pagination/count validation rather than the latest 80 rows from arbitrary days. Incomplete or failed reads are unavailable, not zero intake. Its date updates on time/focus changes, rapid Enter cannot submit multiple UI requests, and successful writes refresh dependent views. Profile projections have separate cache keys. Current onboarding goal names now match the existing nutrition-target calculation names; this is not a new nutrition formula.

**Limits:** source estimates remain estimates. Recipe quantities, diet/allergen suitability, medical appropriateness and automatic calorie choice require real-provider and domain review. No all-allergen guarantee is inferred from a correctly restored allergy field. UI duplicate-click protection is not server-wide generation idempotency across devices. Pagination checks do not claim a single database snapshot while records are edited concurrently.

## Feature acceptance map

| Family                                                       | Evidence in this change                                                                                                            | Still required before broad production approval                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Public pages and access routing                              | 26 production URLs opened without an account; public pages rendered, protected pages redirected to sign-in; no uncaught page error | Real login, OAuth, password-reset delivery, refresh/revocation and account deletion                          |
| Training questionnaire and saved programmes                  | Real route components against explicit synthetic read/write boundaries; input/catalog/activation contract tests                    | Actual AI response and authenticated persistence; concurrent activation/session start                        |
| Workout execution and history                                | Existing deterministic/service tests retained in the full suite                                                                    | Complete authenticated Start → set logging → offline/reconnect → Finish → History journey                    |
| Meal plan, adaptation, translations                          | Domain checks and real UI/cache/reload scenarios with synthetic responses                                                          | Live two-part AI output, allergy/recipe review, actual cross-client update race and translation delivery     |
| Food diary                                                   | Paged-read/service tests, failed/empty separation, rapid Enter and reload UI checks                                                | Authenticated persistence, denied writes and multi-device concurrent edits                                   |
| Hydration, body metrics, readiness, reminders                | Existing implementations preserved, included in static map and existing test suite                                                 | Device/date/notification and real database flows; no browser-closed push promise                             |
| Today, Twin, Lab, future projections and journal             | Existing browser/unit suites are retained for CI                                                                                   | Existing visual gate remains separate; not a new medical or predictive accuracy certification                |
| Coach, photos, form/AR, supplements and external health data | All declared actions included in the inventory; no speculative deletion of working modules                                         | Provider failure/consent paths, supported camera/microphone hardware, ingest isolation and source provenance |
| Billing and security                                         | Existing webhook tests retained; Supabase policies and deployed Netlify metadata inspected read-only                               | Paddle sandbox checkout/webhooks/cancellation/access; live RLS and secret/config review                      |

## Reproducible checks

Run `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build` and `npm run test:browser:core`. The new Core workflows browser CI job installs Chromium and retains screenshots/results. Local Chrome is selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; tests do not access a real athlete account or AI provider.

The latest exact-commit results are recorded in the PR completion comment and `work/continuation-20260909-app-audit/`. Initial failures were retained, not recast as success. Final acceptance must reference the submitted commit, not an earlier 18-scenario intermediate run.

Supabase's leaked-password-protection warning was observed but its Auth configuration was not changed. The intentionally inaccessible server-only tables were not opened to clients to silence informational RLS diagnostics. No migration, live payment, production deployment or `main` merge is part of this change.

## Real staging transaction verification

After independently confirming the new restrictive policies in staging and their absence from production, a new two-account synthetic transaction was executed against `gyms-life-staging` and rolled back. It verified owner-correct training and meal activation (one active plan, previous records retained), workout/set creation, unique set rejection, single conditional completion, summed dated nutrition rows, cross-account read/update/activation denial, denial of foreign parent references and reparenting, and preservation of the second account's valid own plan/session/set chain. It returned PASS. No real account, payment or production write was part of this probe.

The repository migration is `supabase/migrations/20260909082851_workout_parent_ownership.sql`. Read the separate `APP_SESSION_AND_OWNERSHIP_VERIFICATION.md` for the boundary. The SQL/RLS test does not certify browser authentication, AI output quality, email, cameras or payments. Production still needs the reviewed migration and release checks.
