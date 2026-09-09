# First auditable Night Lab review cycle

## Baseline, scope and actual delivery boundary

This block continues the **same main-targeting integration PR #61** from `33e0d67fef3ea91a3a9ad7f974e71ae34cce4a8a`. The account-scoped offline implementation was already committed and passed all eight workflow groups; its artifacts were re-read before this work. The earlier chat claim that the tools were unavailable and only `760155e` existed was incorrect. The verified offline work was not repeated or reverted.

The new slice is **snapshot validation → matured prediction result → deterministic hypothesis ledger → confirmed per-athlete receipt → morning display**. It is not a completed autonomous science council, an experiment engine, or automatic model-weight learning. The receipt explicitly fixes `modelChanged` and `planChanged` to false.

No production deployment, production migration, real user's workout/account change, live AI call or payment change is included. A new report-table migration was applied only to `gyms-life-staging`. Live authenticated device acceptance from the preceding offline block remains an outstanding release gate; controlled tests do not close it.

## What changed in Night Lab

The earlier worker marked a `twin_recalculated` event after any resolved snapshot call, even if the call returned `snapshot: null` because a source or consent check failed. It now requires a confirmed owned snapshot and a readable persisted review receipt before adding that marker. A blocked snapshot skips both evaluation and hypothesis stages. Failed stages remain unavailable, not successful zero-result analyses. A readable cold start remains valid and may correctly yield zero observations.

Candidate discovery includes the existing workout/health/check-in sources, newly created body/nutrition records, and due pending completion predictions. An expired forecast can therefore be checked even when its owner has not logged another workout. Every source is bounded; an unreadable, malformed or truncated candidate scan is reported as a selection failure instead of silently claiming complete coverage. The per-run athlete cap remains 40; a larger-scale fair cursor/queue is not implemented by this change. Body-metric edits have no updated-at field in the current schema, so this is not a claim that every possible modification is a fresh candidate signal.

For each candidate, a verified IANA time zone is required. The per-athlete review day is derived from the job's evidence cutoff in that zone, while the global run key remains UTC-day scoped. Snapshots and their source versions remain canonical; the review table stores an audit receipt, not another full copy of user truth. The cutoff is the calculation reference time, not a claim of an atomic historical database snapshot: underlying mutable source reads are not one MVCC transaction. Each receipt therefore names the actual immutable athlete snapshot it used; it is not a full historical-rewind reconstruction.

## Prediction review and hypothesis history

The shared completion-reconciliation entry point now delegates to a pending-only bounded reviewer rather than loading the latest 64 records regardless of whether they were already evaluated. A matching completed session inside the prediction window is positive evidence. No completion is a negative outcome only after the horizon ends and only when the completed-session read was successful and untruncated. A 513th completion row is a completeness failure, not evidence that a later workout never happened.

Every conditional write includes user, decision and original prediction ID/generation time plus null actual/evaluation guards. A zero-row concurrent update is not counted again. The receipt reports evaluated **records** separately from distinct decision **days**, because repeated predictions on one day are not independent samples. Hitting the prediction batch cap marks limited coverage and a partial review. This does not change the original forecast, its model version or decision eligibility.

Hypotheses use the existing `buildAthleteHypotheses` and canonical `personal_timeline_events` transition ledger. The previous state is read separately for each current hypothesis, so a busy hypothesis cannot consume a global history limit and hide another's state. Transitions require a confirmed write/read and retain the immutable snapshot ID. The UI does not report a hypothetical transition merely because a best-effort audit function resolved. These remain the existing two deterministic hypothesis families, not causal discovery or a new trained neural model.

The original prediction contract uses the positive completion time in `evaluatedAt`; the review receipt separately records when this verification was actually performed. No unannounced prediction-schema or historical-data migration was made.

## Confirmed receipt and security

Migration `20260909153127_night_lab_review_receipts.sql` creates `night_lab_reviews` and the service-only `commit_night_lab_review` function. Authenticated users can read their own rows through RLS but cannot insert, update, delete or call the writer. Anonymous access is denied. The writer checks the actual job ID, current running lease timestamp, window cutoff, valid time zone, stage consistency and same-owner snapshot reference. It rejects stale claims, future review times and assertions that this workflow changed model weights or plans.

One job/user pair has one immutable receipt. A duplicate invocation returns that existing receipt rather than overwriting it or claiming a second learning event. The server reads the stored receipt back before reporting it as saved. A successful RPC transport without a readable matching row is not success.

Actual staging rollback tests used newly generated synthetic account, snapshot and job identifiers. They verified receipt persistence, duplicate protection, snapshot ownership, stale-worker denial, stage/clock/model-claim rejection, owner-only read and denied browser writes. A separate rollback probe verified that deleting the synthetic owner cascades both the snapshot and review rows. These tests are DB-contract checks, not two real browser logins or a production Night Lab invocation. All test rows were rolled back. The repeatable receipt/ownership probe is retained at `tests/night-review.rollback.sql`.

The normalized local SQL routine body matches staging's `pg_proc.prosrc` fingerprint (`7bf465db2521339b2a6e26a0dbecb386`). Only the new table/routine contract was added to the generated-type file; unrelated source types were not regenerated or reformatted wholesale.

## Runtime dispatch versus proof of completion

Netlify's published documentation gives scheduled functions a 30-second limit and background functions a 15-minute limit. The old scheduler awaited the entire application job behind a 60-second fetch timeout, which did not solve that platform mismatch.

The scheduled function now sends a bounded request to `night-lab-worker-background` and accepts only the platform's 202 queued response. It does **not** say that analysis succeeded. The background entry imports the same canonical application modules and uses the existing rotating cron-secret guard before touching the worker. Configuration rejection and unconfirmed failed work are surfaced; no secret or user data is included in log messages. The authenticated internal API likewise dispatches rather than blocking on the whole run.

The isolated bundle check builds both function entries, verifies that the actual canonical Night Lab/review modules are included, imports the worker, confirms `background: true`, and exercises the unauthorized guard. It neither sets live provider keys nor calls the job. This checks the package/path assumptions but is not a Netlify production deployment test.

A reclaimed job retains its original persisted evidence window while acquiring a new lease timestamp. This prevents its new receipt from disagreeing with the parent job or silently changing the cutoff underneath previously confirmed athletes. Invalid claim-window metadata is unavailable, not reconstructed from a guess.

The database claim/receipt protects accepted results from stale workers. It does not guarantee every side effect is globally exactly-once under process loss. The existing job ledger treats a completed failed period as finished, so platform retries may see that failed period and skip it; a subsequent daily run may reconsider the evidence. Same-period per-athlete recovery/cursors and prolonged third-party DB outages remain operational follow-ups. The worker's ten-minute admission budget is checked between athletes; it does not magically cancel all nested legacy DB calls.

## Morning display and daily-brief account isolation

Today and Lab read a per-user persisted review through the authenticated request context. The reader distinguishes no receipt from an unreadable receipt. The card shows the stored local day/time, confirmed versus partial/blocked status, record/day counts, hypothesis transitions and explicit limits. Older receipts are labelled as earlier, not silently presented as last night's successful work. The older timeline marker is described only as a snapshot marker, not proof all stages completed.

While connecting this view, the existing AI SmartBrief was found to cache responses in an ownerless `gl_brief_<language>_<zone>_<day>` localStorage key. That cache could survive an account switch. The current component no longer reads or deletes those old cache bytes; it uses an account/date/zone/language-scoped query and includes an expected owner validated against the real authenticated context. Delayed responses do not paint into a different user's query. The shared brief Zod contract was extracted without changing its response shape so the application and tests use one schema. This is an identity fix, not a claim that all AI advice has been clinically validated.

## Acceptance and remaining work

Controlled service-chain tests run the real review engine, forecast evaluator, hypothesis transition service, receipt acknowledgement and morning reader over synthetic database replies. Real browser tests exercise MorningLabReview, SmartBrief and AuthProvider in Chromium/WebKit with synthetic responses: absent/unavailable/blocked/partial/stale/invalid states, no false zero counts, distinct days versus rows, unchanged models/plans, old cache rejection, A/B transitions and delayed replies. Existing core/offline/auth/Today/Twin checks remain required.

Production still needs the preceding foundation schema reconciliation **and this new receipt migration** before the worker or reader can operate there. No scheduler is enabled in production by editing this branch. Next is a controlled staging deployment with a genuine test-account start/record/sync/finish journey, then a manually authenticated worker invocation that produces a real report and morning read. Do not use a synthetic receipt or a 202 dispatch response as evidence that a live overnight cycle ran.

Later work remains: robust fair job pagination/retries, actual mobile/wearable sources, broader hypothesis/experiment models, calibrated model-version promotion, and safe user-mediated changes. Payments stay deferred.

## Commands and primary contracts

Run `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build`, `npm run test:bundle:night-lab`, `npm run test:browser:night-review`, plus existing browser suites. The new Night Lab review workflow runs Chromium and WebKit independently; exact-head results belong in the completion comment, not in an earlier commit's evidence.

- https://docs.netlify.com/build/functions/scheduled-functions/
- https://docs.netlify.com/build/functions/background-functions/
- https://docs.netlify.com/build/functions/configuration/
- https://supabase.com/docs/reference/javascript/using-filters
