# Manual run submission identity and same-tab recovery

This extends the released PR #140 implementation. It does not merge or replace the competing saved-run enrichment implementation in PR #141.

## Contract

`logEnduranceActivity` now accepts a strict `{ownerId, submissionId, activity}` envelope through the existing authenticated middleware. The asserted owner must equal the authenticated context before any service query. The same action also retains its strict legacy plain-activity input for compatibility for already deployed clients; it does not gain an idempotency guarantee.

The new path inserts the submission UUID as the existing `workout_sessions.id`, with an immutable versioned `manualSubmission` receipt inside `workout_snapshot`. The existing primary key prevents two retained rows with the same submission ID. A duplicate-key result is not sufficient evidence: the service must reread the owned record, validate its immutable receipt, completion timestamps and actual execution measurements. Changed payloads, unrelated records, unreadable rows and foreign owners do not receive acknowledgements. No upsert, delete, administrator write, replacement workout or new database table is involved.

Primary persistence and secondary race-plan enrichment remain separate. Retrying a confirmed primary save may rerun the existing safe enrichment path but does not reinsert the session. A replay refreshes endurance views without emitting another training-completed event.

## Browser recovery

Before contacting the server, QuickRunLog retains the exact request and verifies the write in an owner-scoped **sessionStorage** entry. Its original timestamp and measurements are frozen during uncertainty. Reloading the same browser tab restores this request; only an explicit user action resends it, with the same UUID. There is no background scheduler or automatic retry.

Acknowledgement requires matching owner, submission ID, session ID and execution evidence. Only then is the pending entry removed. Corrupt or inaccessible storage is not interpreted as an empty entry, and a refused initial write prevents a new network request. A failed removal retains the same identity for another check. A stale response cannot remove a newer request. Identity epochs and component lifetime guards prevent old-account results from changing a new account's view or emitting its events.

Pending data consists of the form input and request identifiers, not authentication credentials. It is kept only in the tab session and removed after confirmation. Another signed-in owner cannot restore or submit it as their own.

## Boundaries

- This is **one retained workout per submission identity**, not semantic deduplication of two separately entered runs with different UUIDs.
- Recovery survives reload in the same tab, not deliberate storage clearing, closing the tab, browser eviction or another device. Do not promise durable cross-device recovery.
- After deletion of the original workout, no separate tombstone ledger exists. The at-most-one-row guarantee is based on the retained canonical row, not eternal request-history retention.
- Persistent recovery of the *secondary enrichment notice* remains separate work.
- An old cached client using the unkeyed endpoint retains its old behavior. Malformed envelopes cannot silently fall back to an unkeyed save.
- Unknown outcomes remain unknown; the UI does not claim that a failed response proves no record was written.

## Verification scope

Server tests execute actual supabase-js request construction against scripted HTTP responses. They cover primary response loss, duplicate-key readback, failed reads, invalid receipts, mutated execution, manual provenance, legacy compatibility and acknowledgement identity. Store tests cover reload identity, owner isolation, corruption and refused writes/removals.

The real QuickRunLog is exercised with synthetic services in the existing Core browser suite, including original saved-run enrichment cases plus six primary-save recovery scenarios. Browser fixtures retain their simulated server result across reload and count writes separately from endpoint calls. This is not a live authenticated production transaction or a live PostgreSQL concurrency acceptance test.

Production schema was inspected read-only while preparing this change: `workout_sessions` has RLS enabled, `PRIMARY KEY (id)` and `workout_sessions_snapshot_immutable`. No SQL mutations, migrations, policy changes, dependencies or production configuration changes are required by this patch.
