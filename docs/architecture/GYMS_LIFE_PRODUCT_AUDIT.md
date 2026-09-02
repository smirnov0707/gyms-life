# GYMS.LIFE Product and Intelligence Audit

**Audited:** 2026-09-02
**Scope:** the `main` branch, the live Supabase project and the production Netlify configuration.

## Product decision

GYMS.LIFE should be a personal human-performance intelligence product, not a dashboard or a catalogue of AI tools. The product's durable output is one safe, explainable next action for a specific person on a specific day.

Every new capability must improve at least one of these:

1. What the system knows about the member.
2. The quality and confidence of the next decision.
3. The clarity with which the member can act on that decision.

## Current state

### Working foundations

- The application uses TanStack Start, typed Supabase clients, server functions and a production Netlify SSR build.
- The data model already covers profiles, training plans and sessions, set logs, body metrics, readiness, nutrition, meal plans, health samples, supplements, exercise media, coach messages and consent records.
- All currently exposed application tables have RLS enabled. User-owned data is scoped by `auth.uid()` in the application policies.
- AI model routing is centralized in `src/lib/ai-orchestrator.server.ts`. Features choose a task, not a provider or model. Provider access remains behind `src/lib/ai-gateway.server.ts`.
- AI inputs and outputs use Zod contracts at feature boundaries. Stored plans and meal plans are parsed before use.
- The latest production schema includes durable workout-readiness snapshots, idempotent set logging and atomic activation for training and meal plans.

### Current product capability

The product can collect onboarding data, generate and activate workout and meal plans, run workouts, log sets and meals, capture readiness, show progress, provide a coach conversation, scan selected visual inputs, and export reports.

The live database currently contains only seed-stage member activity. It is therefore essential that all intelligence remains explicit about low confidence and uses a strong cold-start experience instead of implying personal learning that has not happened.

## Current gaps

### P0 — correctness and trust

- **Resolved in this audit:** production code expected readiness-adaptation fields and plan-activation RPCs that were present in the repository but not yet applied to the live database. The live schema and its migration history now match `main` for those contracts.
- **Resolved in this audit:** report and micronutrient context builders used `SupabaseClient<any>` and manual response casts. They now consume `Database` and generated table types directly.
- **Still requires a dashboard action:** Supabase Auth leaked-password protection is disabled. It should be enabled before public acquisition begins.
- `paddle_webhook_events` has intentional deny-by-default RLS with no policy for browser roles. Supabase reports it as informational because no RLS policy exists; access is already revoked from `anon` and `authenticated`.

### P1 — product architecture

- The product has useful memory and insights tables but not yet a complete Digital Athlete Model, evidence ledger, hypothesis ledger, recommendation ledger or experiment lifecycle.
- Several pages are individually strong, but the mobile primary navigation exposes six destinations while more important daily decisions live deeper in the product. This makes the experience feature-led instead of decision-led.
- The current overview contains useful cards, but it still asks the member to interpret several signals. The target is one concise daily story with one primary action and an optional explanation.
- Personalization is mostly built at request time. It should gain a durable, versioned athlete state that records facts, confidence and recency separately from model-generated language.

### P2 — delivery and observability

- There is no end-to-end test that signs in, completes onboarding, generates a plan and starts a workout against controlled provider responses.
- The app needs production-level event observability for failed server functions, provider latency, provider errors, validation failures, plan activation and recommendation acceptance.
- Client bundle warnings should be addressed after the core product flow is stable; they are not a functional blocker.

## Target information architecture

The authenticated product should be organised around the member's next decision:

1. **Today** — daily state, the one recommended action, why, confidence, and a single CTA.
2. **Train** — the active session, exercise library and technique support.
3. **Nutrition** — today’s intake, the active meal plan and quick logging.
4. **Progress** — trends, goal trajectory, weekly review and discoveries.
5. **More** — coach history, reminders, supplements, achievements, privacy and account controls.

The mobile dock should contain only the first four. Secondary tools should remain reachable but must not compete with the daily decision.

## Target Digital Athlete Model

The model is not a free-form AI summary and is not owned by a provider. It is a GYMS.LIFE-owned, versioned domain model built from four layers:

| Layer | Owned data | Purpose |
| --- | --- | --- |
| Facts | profile, workouts, sets, nutrition, body metrics, check-ins, health samples | What happened and when. |
| Derived state | volume trends, strength estimates, readiness, adherence, energy balance, recovery load | What the facts currently indicate. |
| Evidence and confidence | source event IDs, recency, sample size, confidence and expiry | Why the system believes a conclusion. |
| Decisions | recommendation, alternatives, reason, safety constraints, acceptance and outcome | What GYMS.LIFE advised and whether it worked. |

Language-model output may enrich explanations, coaching tone and structured observations. It must not create durable physiological facts without recorded evidence or a clearly marked user report.

## Target intelligence architecture

```text
User actions and connected data
        ↓
Validated domain events
        ↓
Deterministic metrics and safety rules
        ↓
Digital Athlete Model + evidence + confidence
        ↓
Decision Engine
        ↓
GYMS.LIFE AI Orchestrator
        ↓
Specialized provider-neutral workers
        ↓
Zod validation and safety guard
        ↓
Persisted recommendation, explanation and outcome
        ↓
Today experience
```

The existing orchestrator is the correct provider boundary and must remain the only route by which user-facing AI calls choose a model. A feature may declare a task and validated input, but it must not import an AI provider or select a model itself.

## Target data architecture

Keep Supabase `Database` types at the persistence boundary. JSONB fields are untrusted raw storage and must be parsed into Zod-derived domain models before business logic or AI context uses them.

Add these application-owned, RLS-protected domains incrementally:

- `athlete_observations`: validated facts and calculated measurements with source and timestamp.
- `athlete_state_snapshots`: a versioned current state, generated deterministically from observations.
- `decision_records`: recommendation, alternatives, rationale, confidence, safety constraints and status.
- `decision_evidence`: links between decisions and concrete facts or derived metrics.
- `hypotheses`: a bounded claim, confidence, expiration and supporting evidence.
- `personal_experiments`: opt-in interventions, success measures and stop conditions.
- `recommendation_outcomes`: acceptance, completion and observed effect.

Do not store any of these as an opaque, provider-owned chat transcript. Use narrow relational records for behaviour that requires filtering, auditing or explanation; reserve JSONB for validated, versioned payloads with schemas.

## Migration strategy

1. Keep the current migrations as the one source of schema history.
2. For each schema change, create the migration in the repository first, run it in a disposable branch or local database, regenerate generated types, and then deploy it to production.
3. Verify RLS, grants, indexes and constraints against the live project after every deployment.
4. Never apply a schema change through a dashboard-only path. If emergency production work is unavoidable, immediately repair migration history and commit the resulting migration contract.
5. Every user-owned table needs RLS plus ownership-safe `USING` and `WITH CHECK` clauses; every privileged function needs restricted `EXECUTE` grants and an explicit `search_path`.

## Phased implementation plan

### Phase 0 — completed and continuously enforced

- Stabilize the plan-generation provider boundary.
- Keep DB migrations, generated types and production schema aligned.
- Remove unsafe persistence casts from server-domain boundaries.
- Keep plan activation, meal-plan activation and set logging deterministic and idempotent.

### Phase 1 — Digital Athlete Model

- Introduce observations, state snapshots and calculation services.
- Derive training load, adherence, strength trends, recovery and nutrition consistency without AI.
- Add sample-size, recency and confidence rules.

### Phase 2 — Today and workout experience

- Redesign the authenticated information architecture around Today.
- Replace card-first interpretation with one recommended action, a clear alternative and an expandable explanation.
- Ensure workout execution uses the same persisted readiness adjustment from start through completion.

### Phase 3 — decisions, evidence and learning

- Persist recommendations and their evidence.
- Add acceptance, completion and outcome recording.
- Ship weekly intelligence review only when it can cite sufficient data.

### Phase 4 — proactive intelligence

- Add a constrained notification policy based on meaningful state changes.
- Introduce hypotheses with expiry, confidence and a user-readable explanation.
- Add opt-in personal experiments with safety limits and measurable outcomes.

### Phase 5 — advanced data sources

- Add wearables only behind explicit consent, a validated ingestion contract, idempotency keys and source-quality labels.
- Keep connected data optional; manual logging must remain a fully supported path.

## Quality gates

No feature reaches production until all applicable gates pass:

- TypeScript typecheck, formatting and unit tests pass.
- Server inputs, provider outputs and persisted JSON are Zod-validated.
- A live schema check confirms the generated `Database` contract, RLS, grants and critical indexes.
- A controlled end-to-end path covers authentication, onboarding, plan generation, activation, workout start, set log and workout finish.
- AI failures return localized, actionable messages and never expose provider internals.
- The UI has loading, empty, error, offline/retry and narrow-screen states.
- Every recommendation has a reason, confidence state and safe fallback.

## Risks to manage

- Fitness and nutrition suggestions must remain non-diagnostic and must route medical-risk language to professional care.
- Sparse member data must lower confidence, not trigger fabricated insight.
- AI-provider outages, quotas and model changes must degrade to deterministic functionality where possible.
- Health and biometric data require minimal collection, explicit AI-personalization consent, export/delete controls and strict server-side authorization.
- High-cardinality health streams require aggregation and retention rules before storage volume becomes a cost or performance problem.
