# Twin timeline read model

This change adds a collapsed, read-only history panel below the existing Twin. It does not change the recovery heuristic, renderer, source writers, database schema, or authorization policy.

## Meaning of the history

`personal_timeline_events` remains a compact index, not a source of physiological truth or a historical DigitalAthleteState replay. The UI explicitly states this distinction. The first view shows up to 30 latest indexed events; one extra row determines whether older indexed events exist. It never promises complete history or backfills missing events.

`occurred_at` is displayed as the indexed event time. `created_at` is displayed separately as the timeline index write time, not the time the original domain row was written. In particular, a workout-completion event is not evidence of when every set was performed. No delay is automatically diagnosed as an offline sync.

Times use each validated source IANA time zone. A missing/invalid zone stays unknown; UTC is used only for display and is explicitly disclosed. Original timestamps and offsets are preserved. Ordering compares instants, not strings.

## Ownership and data minimization

The server function accepts no user identity or arbitrary query options. It uses `requireSupabaseAuth`, `context.userId`, and the request-scoped Supabase client. The reader also applies a user_id filter. The existing own-row SELECT RLS policy remains unchanged.

Only bounded metadata is selected. Arbitrary summary JSON, original health payloads and user_id are not returned to the browser. Source references are escaped text, not executable URLs or untrusted navigation targets. The React Query key includes the signed-in user; requests are disabled until the panel is expanded and auth is ready. The panel hides on sign-out, does not use previous-user placeholder data, and has zero cache retention after its query becomes unused.

## Failure and uncertainty

A failed or null query throws; it is never an empty history. A malformed whole response throws. Individual malformed rows are withheld and counted in a visible warning. Unknown event/provenance/quality vocabulary stays unknown, rather than becoming measured or high quality. An all-invalid result does not show the empty-history message.

## Verification and release

The added Vitest suites cover delayed index writes, offset ordering, tie-breaking, unknown metadata, invalid timestamps, bounds, ownership filters, metadata-only selects and failed reads using a mocked HTTP transport. No real user records are needed for these tests.

Before production release run `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:browser`. Check collapsed/expanded/error/empty history at mobile width in light and dark themes, keyboard operation, and auth isolation. A passing mocked transport test is not an authenticated browser or production-RLS smoke test.
