# Twin evidence guard and logged-volume layer

## Baseline and scope

Continues `92817c0f6151d823758a00df55f870d060b177fd`, including PR #31's
continuous 360-degree surface. Do not apply the obsolete primitive-body patch.
This change preserves geometry, authentication, Supabase schema, camera and
provider orchestration. It adds no physiology model or wearable data.

## Evidence correction

Only explicitly completed sets (`done === true`) count. Missing/non-positive
reps or external weight, invalid timestamps and unsafe numeric aggregates
withhold the **whole affected muscle group** from the volume-decay estimator.
Mixing one incomplete completed set into several complete sets must not make a
partial sum look complete. Other groups remain available. Raw logs are never
modified or deleted; the existing mapper represents omitted groups as unknown.
Future-dated sets are not past evidence and are skipped, not dated to "now".

Zero external load does not mean zero effort. Bodyweight, assisted, timed and
other unsupported work require another model. This conservative gate may show
fewer estimates than before. It must not tell a person they did not exercise.
Unknown-state copy now explains insufficient/unsupported data instead of
claiming that no sets were recorded.

The existing exponential-decay equation is unchanged for supported inputs.
Its 40-hour denominator is a time constant, not a mathematical half-life; the
constant name/comments are corrected without altering its numerical value.
This is still a heuristic, not a validated physiological recovery measurement.

Derivation identity advances to `digital-athlete-v2`. Snapshot fingerprints
include the calculation version so identical values under different derivations
do not silently reuse the old model identity. Existing history is not rewritten;
no schema or database migration is required.

When a source is unavailable, the mapper and both display layers withhold old
values. Unknown provenance always wins over any leftover number.

## Two views of the same canonical state

- Recovery: existing calculated percentage and canonical recovery bands.
- Logged volume: existing `volumeKg`, sum of registered weight × repetitions.
  No new physiological calculation and no fabricated set weights.

The single layer selection lives in `TwinSnapshotView`. Inspector, ranking,
legend, accessible selector, 2D map and 3D runtime read the same selection.
Switching a layer updates materials without recreating WebGL, changing camera
position, dropping selection or re-requesting the backend. Context-loss and
manual 2D fallback retain the selected layer.

Blue volume tones use thirds of the largest known group volume in the current
snapshot (including listed off-body groups). These are **display categories**,
not clinical thresholds, training targets or valid comparisons of muscular
effort. The legend and copy explain the relative scale. Whole-body/cardio data
remain in the list; they are never distributed onto individual body regions.
An explicit recorded zero differs from missing volume; a null stays unknown.
The incomplete-group guard deliberately withholds partial totals as well.

## Verification

Run `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build` and
`node scripts/test-twin-browser.mjs`. The browser harness uses synthetic data,
not an authenticated user or a production bypass. It now tests layer agreement,
units, camera/selection preservation, source failures, restoration, mobile
volume views and missing inputs as well as the previous orbit/fallback checks.
An optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects an installed browser for
local testing; CI uses the pinned Playwright Chromium by default.

Physical iPhone/Android GPU, battery and authenticated production smoke tests
remain separate checks. This change does not resolve unrelated dependency
advisories or existing lint warnings. Browser artifact directories are ignored.

## Rollback

Revert this release through a reviewed PR. No user-data rollback is needed.
Do not blindly reuse previous derivation identifiers for different equations.
