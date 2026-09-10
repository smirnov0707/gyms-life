# GYMS.LIFE personal model evolution — first closed learning loop

## Scope

This block adds the first application-owned model that can change from an athlete's observed outcomes. It continues PR #61 from `745b6c1`; it does not replace the Digital Athlete, Today decision engine, Night Lab, memory, or external AI router.

The first target is deliberately narrow: **probability that a recommended workout will be completed**. Completion has an observable outcome, an existing transparent baseline, low direct safety consequence, and a durable prediction ledger. This is therefore a better proving ground for learning mechanics than inventing a physiological recovery score.

The learner is a statistical shadow challenger owned by GYMS.LIFE. It is not an OpenAI/Gemini/other-provider model and does not put user truth into an AI vendor. Its model ID is `workout-completion-personal-logit-offset`, algorithm version `0.1.0`.

This block does **not** claim that GYMS.LIFE is smarter than a doctor, analyst, human coach, or every AI. It establishes machinery by which one bounded model can earn evidence of improvement. Medical superiority, causal conclusions, and general intelligence require separate validation.

## Training protocol

The source model remains the transparent `workout-completion-usual-day-baseline` version `0.1.0`. The personal learner estimates one ridge-regularized log-odds offset from the athlete's observed baseline probabilities and actual completion outcomes.

Training is withheld until at least **12 distinct evaluated days** exist and both completion and non-completion outcomes are represented. One local calendar day contributes at most one baseline forecast: the earliest eligible forecast for that day.

The server requests at most **365 unique evaluated days**, ending on **yesterday in the athlete's own IANA timezone**. The current/local incomplete day is not training evidence. The database reader is service-role only and returns only evaluated predictions for the exact baseline model/version.

The model artifact records its training start/end days, class counts, algorithm/source versions, bounded parameters, and a SHA-256 evidence fingerprint. The fingerprint covers each training day's baseline prediction identity, generated time, probability, and actual outcome, so changed evidence produces a different artifact history.

## Shadow prediction and leakage boundary

Today still builds its action **before** prediction plumbing and never reads the personal challenger. The normal baseline forecast is persisted first. Personal capture then reads that exact stored baseline and may write a separate shadow forecast for the same decision.

A challenger is allowed only for a `shadow` artifact and only when `decision_on > trained_through`. It must share the baseline's generated time, horizon, athlete-state snapshot, target and source model/version. Its own model version includes the artifact identity, and its UUID is deterministic from artifact + decision for retry safety.

The database independently checks the artifact owner, decision owner/day, pending baseline state, exact model versions, timestamps and snapshot. It recomputes the expected challenger probability from the stored baseline plus stored log-odds offset; a caller cannot submit a different probability and still receive an acknowledgement.

A qualified artifact is frozen and cannot emit additional challenger forecasts. A late retry remains idempotent; a wrong baseline pair, training-period decision, wrong owner, forged probability or client-side RPC attempt is rejected.

## Forward-only evaluation

The challenger is never evaluated on its training days. Outcomes come from canonical completed workout sessions. A completion inside the forecast horizon is positive evidence. Non-completion is observable only after the horizon closes and only if the workout source read itself succeeded.

Qualification uses the **first 20 distinct future outcome days** after the artifact's training cutoff. Once those 20 exist, later days cannot rescue or overturn that artifact's predeclared evaluation. Before 20 days, numerical quality metrics are withheld.

The paired test reports Brier score, log loss, calibration gap, mean paired Brier improvement and a lower 95% improvement bound. Qualification additionally requires at least two positive and two negative outcomes, a positive lower bound, lower Brier and log loss, and no material calibration degradation beyond the declared tolerance.

Both application code and the database use the exact same paired forward evidence. The qualification RPC recomputes the stored pairs and metrics before changing status; caller-provided numbers are evidence to verify, not authority. A forged metric cannot qualify a model.

## Continuous lifecycle

If a shadow challenger reaches its 20-day holdout and proves the predeclared improvement, its artifact becomes `qualified`. **Qualified still means shadow-qualified, not production authority.** It remains visible as evidence that the challenger passed its forward test, while Today continues to use the existing deterministic decision path.

If the challenger reaches 20 days without qualifying, Night Lab fits a replacement from the newer bounded training history. Rotation is atomic: the old artifact becomes `retired` and the replacement becomes the single active `shadow` artifact in one database transaction. The replacement must advance `trainedThrough` and have a different evidence fingerprint.

The rolling window can continue moving even after it contains 365 observations; the next artifact does not need an ever-increasing row count. This prevents the learner from becoming permanently stuck after one year while retaining a bounded recent-evidence protocol.

Night Lab first reconciles pending personal predictions, then evaluates or evolves the active artifact. The persisted Night Review has an optional `modelLearning` stage for backward compatibility with older receipts. A blocked athlete snapshot cannot run learning. An unavailable learning stage makes the new review partial, not falsely complete.

Pending challenger reconciliation is bounded to the oldest **64 records per Night Lab cycle**. If more exist, the oldest batch is processed and the remainder is left untouched for a later cycle; the receipt records `limited: true` and the whole Night Review is `partial`, never falsely complete. A malformed pending challenger or a missing/mismatched baseline pair is an unavailable evidence condition rather than a silently smaller sample.

The Morning Review shows factual lifecycle states: insufficient history/variation, newly trained shadow, forward holdout progress, qualified shadow, replacement shadow, or unavailable learning. Its copy explicitly distinguishes a learning challenger from the model that currently drives Today.

## Persistence and access boundary

`personal_model_artifacts` and `personal_model_predictions` are user-owned tables with RLS. Authenticated clients have owner-read access only; writes and model lifecycle RPCs are service-role only. Composite owner foreign keys prevent a prediction from binding another user's artifact or decision.

The staging schema also has covering indexes for artifact/decision owner references. The Supabase performance advisor reports no unindexed-foreign-key finding for the new relations; it currently reports only informational unused-index findings, which are expected before the new shadow path accumulates traffic. The security advisor reports no finding for the new learning tables; four pre-existing service-only tables remain listed as informational RLS-with-no-policy notices. Advisor references: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index and https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .

## Staging evidence

All schema changes in this block were applied to `gyms-life-staging` only. Migration filenames were aligned to the versions actually recorded by the staging migration ledger rather than rewriting already applied history.

Rollback-only PostgreSQL probes with generated synthetic users verified owner isolation, strict baseline/challenger pairing, formula-derived probability validation, forged probability/metric rejection, idempotent receipts, qualification from exact frozen forward evidence, atomic retirement/replacement, one-active-artifact uniqueness, the 365-unique-day/yesterday cutoff, owner-deletion cascade, blocked browser RPCs, and Night Review learning-stage consistency. No synthetic test rows remain after rollback. Reproducible probes are `tests/personal-model-qualification.rollback.sql`, `tests/personal-model-rotation.rollback.sql`, `tests/personal-model-training-window.rollback.sql`, and `tests/personal-model-backlog.rollback.sql`.

The latest stored function bodies were normalized and fingerprinted against the local migration definitions; all five compared bodies matched. `authenticated` and `anon` execution is denied while `service_role` execution is retained for training reads, challenger commits, qualification, rotation and Night Review persistence.

Application tests cover fitting, evidence diversity, exact fingerprints, retry identity, training leakage, unavailable sources, pending horizons, forward outcomes, qualification confidence, fixed first-20 holdout semantics, rotation and legacy Night Review compatibility. Morning Review runs in Chromium and WebKit with explicit learning, qualified and unavailable states.

## Deliberate limits and next promotion gate

This first learner changes a **forecast model artifact**, not the athlete's training prescription. It does not diagnose disease, infer hidden physiology, establish causality, or authorize harder/easier exercise. A model may be statistically better at completion prediction and still be a poor policy for long-term performance.

The next step is therefore not to flip `qualified` into production automatically. A separate canary/policy gate must ask whether using the improved forecast actually improves decision quality under safety and long-term objective constraints. That gate needs prospective comparison, rollback, explicit versioning and user-level outcome monitoring.

Other targets — exercise performance, readiness, fatigue, nutrition response and longer-term goal trajectory — require their own observable outcomes, baselines and evaluation protocols. They should reuse this lifecycle machinery only where the target semantics justify it; they must not inherit workout-completion assumptions by analogy.

Production remains unchanged by this block. Payments remain deferred. A live staging account/background-job acceptance is still required before any production schema rollout, and the previously documented production migration reconciliation remains a separate release prerequisite.
