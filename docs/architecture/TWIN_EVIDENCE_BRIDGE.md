# Twin Evidence Bridge

## Purpose

Twin Evidence Bridge connects two immutable, compatible Twin snapshots to the compact `personal_timeline_events` index. It answers only one question: **which indexed events have an `occurred_at` instant inside the transition interval?**

It does not answer why the Twin changed.

## Interval semantics

For an older snapshot A and newer snapshot B, the evidence window is `(A.computed_at, B.computed_at]`.

- The older boundary is excluded because an event indexed exactly at A is not presented as new evidence for B.
- The newer boundary is included.
- Timestamp offsets are normalized to UTC before querying.
- `personal_timeline_events.occurred_at` is the Timeline event timestamp. It is not guaranteed to be the exact exercise, measurement, source-write or physiological-change time.

## Security and privacy

- The authenticated request middleware provides `userId`; browser input never selects identity.
- The request-scoped Supabase client and existing own-row RLS remain authoritative.
- The browser receives the same narrow Timeline projection used by event history; `summary` and `user_id` are excluded.
- Reads are bounded to 31 rows to expose at most 30 events plus an honest `hasMore` signal.

## Epistemic rules

Temporal overlap is not causal attribution. Evidence Bridge must never state or imply that an indexed workout, check-in or decision caused a recovery, load, body or readiness difference.

Missing events are not converted to "nothing happened". A successful empty index interval means only that no indexed Timeline events were returned for that interval. Unknown provenance and quality remain unknown.

## Rendering boundary

The bridge is collapsed by default and queries only when expanded. It does not alter the current 3D Twin, historical snapshot mapper, recovery calculation, Change Map arithmetic or Timeline writer.
