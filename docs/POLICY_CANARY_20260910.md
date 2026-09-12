# GYMS.LIFE policy canary — 2026-09-10

## Purpose

The first personal completion model now has a separate policy-evaluation boundary. This stage asks a narrower question than model qualification: if a qualified personal completion probability would have suggested a different **presentation strategy**, is that worth testing as a product policy?

It does **not** assume that a better probability forecast is automatically a better coaching decision.

## Current policy candidate

Policy ID: `today-training-engagement`  
Version: `0.1.0`

The baseline presentation is `standard_train_cta`. The only shadow alternative is `choose_start_time_first`, considered when the qualified personal completion probability is below `0.45`.

This candidate is presentation-only. It cannot alter training load, exercise selection, recovery, readiness, plan generation, safety constraints, nutrition targets, or the deterministic Today action.

## Shadow-only gate

The first gate is deliberately counterfactual and unexposed:

- `mode = shadow`;
- `assignment = null`;
- `delivered_strategy = null`;
- `exposure_at = null`;
- `exposure_state = shadow_unexposed`;
- `decision_authority = false`.

A counterfactual row therefore records what the policy **would have selected**, not what the athlete saw.

## Causal boundary

Night Review must keep these facts explicit while the policy remains shadow-only:

- `randomizedExposures = 0`;
- `causalEvidence = false`;
- `promotionEligible = false`;
- readiness state is `shadow_counterfactual_only`.

Observed workout completion can evaluate the source forecast and the shadow record, but it cannot establish the causal effect of an intervention that was never delivered. No retrospective comparison is allowed to promote the policy.

A later randomized exposure protocol, if introduced, requires a separate reviewed contract, explicit assignment persistence, safety envelope, rollout percentage, stopping rules, outcome window, minimum sample, rollback path, and user-facing behavior. None of those are enabled by this branch.

## Staging database state

`gyms-life-staging` already contains the service-role-only `policy_shadow_records` contract and its commit/evaluation routines. The database independently binds a shadow record to the qualified personal model artifact, exact Today decision, source prediction, athlete-state snapshot, local decision day, forecast timestamps and formula-derived personal probability.

The current app source branch is being reconciled to that staging contract before any production migration. Production is not to receive the policy-canary schema merely because the forecast model is qualified.

## Release rule

This branch may merge only after source, generated database types, server integration and Night Review tests agree with the staging contract. Even after merge, shadow policy data alone is not permission to expose a different CTA. Production exposure remains a distinct future gate.