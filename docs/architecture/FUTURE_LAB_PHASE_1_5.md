# Future Lab Phase 1.5 — Prediction-ready Digital Twin

## Objective

Evolve the existing evidence-backed Digital Athlete / Digital Twin foundation into a prediction-ready temporal model without inventing predictions, confidence, anatomy, or wearable data that do not exist yet.

## Current truth

- `DigitalAthleteState` is the canonical calculated athlete state.
- `TwinSnapshot` is a renderer-facing projection of that state, not a second source of truth.
- `athlete_state_snapshots` persists versioned historical state.
- `decision_records`, `decision_evidence`, and `decision_outcomes` form the current Decision Ledger.
- `personal_timeline_events` is the canonical timeline index.
- Lab exposes only engines that actually exist.

## Phase 1.5 invariants

1. **Time is first-class.** Training and health facts must use the time they occurred, not merely database write time.
2. **Provenance survives normalization.** Measured, device-reported, user-reported, calculated, inferred, predicted, and simulated values must never collapse into one unlabeled value.
3. **Unknown is not normal.** Missing evidence must remain explicit and must not silently become a healthy/recovered/default state.
4. **Predictions are durable claims.** A future prediction must be stored with target, horizon, model/version, evidence, uncertainty, and later outcome before it can be called prediction intelligence.
5. **Simulation is not prediction.** Counterfactual and Future Me outputs must remain separately typed from forecasts about the expected real future.
6. **Renderer does not invent physiology.** Visual precision cannot exceed source precision.
7. **No AI-generated physiological facts.** LLM output may explain validated state; it may not create durable body facts without a typed evidence source.

## Canonical temporal contract

Every future normalized observation should be able to express:

- `occurredAt` — when the underlying event happened;
- `recordedAt` — when GYMS.LIFE persisted/received it;
- `source` — GYMS.LIFE, user, device, or external integration;
- `provenance` — measured / device_reported / user_reported / calculated / inferred;
- `quality` — source-specific quality/availability state, not fabricated numeric confidence;
- `sourceRef` — optional immutable reference to the source-domain record;
- `timezone` where local-day interpretation matters.

Do not replace source-of-truth domain tables with a giant generic event table. `personal_timeline_events` is an index across domains.

## Prediction-ready contract

Before implementing a prediction engine, introduce a narrow versioned contract with these concepts:

- prediction target (`readiness`, `workout_completion`, `exercise_performance`, `short_term_fatigue`, later goal trajectory);
- prediction horizon;
- generated-at timestamp;
- model id + version;
- context/snapshot reference;
- evidence references;
- predicted value or bounded range;
- uncertainty/evidence state;
- maturity (`shadow`, `canary`, `production`);
- actual outcome when observable;
- evaluated-at timestamp;
- error/calibration result where mathematically meaningful.

A prediction row must never be written just to make Lab look active.

## First prediction candidate

The first production prediction should be chosen only after an evidence audit. Prefer a target with:

- an objectively observable outcome;
- enough historical samples;
- low safety consequence;
- deterministic baseline to beat;
- clear evaluation timing.

`workout_completion` is likely a better first candidate than a physiological recovery number because completion is objectively observable and the existing behavioral/decision history can support a baseline. This must be verified from real data before implementation.

## Digital Twin renderer evolution

The current body map remains the honest baseline. Evolve it in layers:

1. current 2D segmented body map;
2. renderer-neutral visual-state contract;
3. interactive front/back transitions and meaningful micro-motion;
4. optional WebGL/3D renderer using the same contract;
5. personalized geometry only when body evidence supports it.

Never block intelligence work on a 3D asset.

## Phase 1.5 deliverables

1. Audit all time-bearing domain records for `occurred` vs `recorded` semantics.
2. Audit current provenance fields and unify vocabulary without destructive rewrites.
3. Confirm `personal_timeline_events` can index workout, readiness, body, nutrition, decision and future health events idempotently.
4. Define prediction/model-registry domain contracts before creating UI.
5. Add storage only after contracts and evaluation semantics are agreed.
6. Add tests proving unknown/missing data cannot become a positive state.
7. Keep Today/Twin/Lab reading the same canonical state.

## Quality gate

Phase 1.5 is complete only when:

- typecheck passes;
- tests pass;
- lint passes;
- production build passes;
- schema and generated types match production;
- RLS/grants are verified for any new persistence;
- no prediction or simulation is surfaced without a real engine;
- existing production Today/Twin/Lab behavior remains compatible.
