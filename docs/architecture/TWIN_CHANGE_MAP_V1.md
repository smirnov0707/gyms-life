# Twin Change Map V1 — signed state differences

## Purpose

Twin Change Map extends Rewind with a region-level comparison between two real, immutable, compatible `athlete_state_snapshots`. It answers a narrow question: how did the stored calculated Twin values differ between these two snapshot states?

It does not answer why they changed, whether the change is beneficial, or whether training caused it.

## Compatibility and unknowns

The comparison runs only when both Rewind points are compatible, have the same schema and calculation version, and both renderer projections report their source as available. A region value is usable only when that region has `calculated` provenance in both states. Missing evidence on either side produces a null delta.

No historical row is recalculated under a newer model. No missing body region becomes zero volume or 100% recovered.

## Arithmetic

For each region:

- recovery difference = newer stored recovery estimate minus older stored recovery estimate;
- logged-volume difference = newer stored `weight × reps` volume minus older stored volume.

The recovery value is displayed in percentage points. The map uses sign only: positive, exactly unchanged, negative, or unknown. There is deliberately no threshold that claims a clinically or physiologically meaningful change.

## Rendering

The Change Map reuses the existing 2D anatomical `BodyMap` geometry because that renderer already respects the canonical region granularity. It does not introduce a second body model or modify the current 3D Twin layers.

Positive recovery-estimate differences reuse the cool display tone, negative differences reuse the attention/hot tone, and exact-zero or unknown values use the muted tone. The legend and explanatory copy define these colours locally; they are not global health states.

## Release checks

Typecheck, all unit tests, lint, production build and the existing Twin browser regression suite must pass on the final PR head. Focused tests cover signed arithmetic, unknown preservation, model mismatch, source unavailability and incompatible state refusal. Physical authenticated mobile testing remains a separate release check.
