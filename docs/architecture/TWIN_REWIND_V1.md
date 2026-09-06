# Twin Rewind V1 — immutable state evolution

## Purpose

Twin Rewind exposes previously persisted `athlete_state_snapshots` without pretending that missing time points exist. It is a state-change viewer, not continuous historical physiology, interpolation or prediction.

## Source of truth

The canonical historical row remains `athlete_state_snapshots`. Rewind reads it through the authenticated request Supabase client and the existing own-row RLS policy. The browser cannot provide a user ID. No schema, writer or production data is changed by this release.

A bounded query reads at most 13 rows to expose 12 recent state points and determine whether older points exist. The raw `DigitalAthleteState`, active context, provenance summary, uncertainty summary and user ID never leave the server. A compatible row is projected only to:

- renderer-safe `TwinSnapshot`;
- calculation/schema version and stored timestamp;
- source-window bounds;
- data-quality level and evidence count;
- narrow training, recovery, body and nutrition aggregates already present in the canonical state.

## Compatibility rule

Historical physiology must not be silently recalculated under a new model. V1 renders a historical body only when both the stored schema and calculation version exactly match the current supported Digital Athlete contract. Older or invalid rows remain visible as metadata-only incompatible points. They are never upgraded, filled with defaults or passed through the current calculation rules.

## Comparison semantics

Comparisons are simple `newer - older` arithmetic between two compatible snapshots with the same schema and calculation version. Null on either side produces a null delta. Rolling-window metrics such as sessions in seven days or volume in 28 days are explicitly not labelled improvement, decline, adaptation or causation.

## UI behavior

Rewind is collapsed by default. Therefore the normal current Twin does not pay for a second historical WebGL scene or history query. Opening Rewind fetches the bounded list. Selecting a compatible state mounts one historical `TwinSnapshotView` below the current Twin. The existing renderer contract is reused; no second recovery model exists.

## Quality gates

Release requires typecheck, all Vitest suites, lint, production build and existing Twin browser regression checks. Add focused tests for history bounds, ownership filters, malformed reads, incompatible versions, null preservation, instant ordering and comparison arithmetic. An authenticated mobile smoke test remains distinct from synthetic browser regression coverage.
