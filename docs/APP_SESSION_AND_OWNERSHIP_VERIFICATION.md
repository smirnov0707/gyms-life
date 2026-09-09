# Session continuity and parent ownership verification

## Correctness changes

`loadSessionPlannedDay` resolves a saved workout from its immutable execution snapshot before any programme lookup. A new active programme or a deleted old programme cannot silently rewrite the session's exercises. Legacy sessions without a snapshot fall back only to their own stored plan ID, scoped to the authenticated owner. Both set logging and workout completion use this shared resolver. Missing or invalid source data produces an error, not an invented workout.

The normal programme-activation action still checks for unfinished workouts. That check is a user-experience guard, not a claimed cross-client database lock. Saved-session execution no longer depends on that guard being perfectly serialized.

## Reproduced database defect

On `gyms-life-staging`, a two-account synthetic transaction showed that the old per-row policies allowed an authenticated account to create its own session referencing another account's plan, or its own set-log row referencing another account's session. The corresponding production policy definitions were inspected read-only and used the same child-row-only ownership condition.

The reproduction used newly generated synthetic account IDs and `example.invalid` addresses. It ended in `ROLLBACK`. No real member's rows were read or changed by the probe.

## Migration and verification

Migration `20260909082851_workout_parent_ownership.sql` adds two **restrictive** RLS policies alongside the existing per-row policies. Referenced parent plans/sessions must also belong to the authenticated caller. The migration changes policies only; it neither deletes user data nor grants additional access. Nullable plan IDs remain supported for independent/historical sessions.

The migration was applied to **staging only**, using the Supabase migration action. Its repository timestamp matches staging migration history. No production migration was applied in this audit.

A subsequent rolled-back staging transaction passed these behavioural assertions:

- Valid owner: create two training plans, activate one and then the other, retain the previous inactive plan and have exactly one active plan.
- Valid owner: create and switch two meal plans with the same preservation/uniqueness properties.
- Valid owner: create a workout, save a set, reject the duplicate unique set key, complete once and leave a second conditional completion with zero changed rows.
- Valid owner: save two dated meals and read their actual 1,000 kcal sum.
- Second account: cannot read the first account's plans, meal plans, workouts, set logs or nutrition logs; cannot update its meal plan or activate its training plan.
- Second account: cannot create or reparent a workout to the other account's plan, and cannot attach a set to the other account's session. Its own valid plan/session/set chain remains writable.

All synthetic rows and account records in this validation transaction were rolled back. These database tests exercise real PostgreSQL policies, constraints and activation functions. They are not tests of OAuth email delivery, AI-provider quality, real payments, or browser authentication.
