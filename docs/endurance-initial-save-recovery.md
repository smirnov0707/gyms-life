# Endurance manual-save recovery

This adds retained initial-request identity on top of the released PR #140 saved-run enrichment path. It does not introduce another race matching engine, training history, or source of athlete truth.

## Request and server boundary

New QuickRunLog sends `{ ownerId, requestId, activity }` to the existing authenticated `logEnduranceActivity` action. The server verifies that the requested owner equals the authenticated owner before any read/write. Already-loaded legacy clients retain their old request contract; those unkeyed requests do not acquire the new guarantee.

The same owner and client-generated request UUID derive the same UUIDv5 workout session ID. The server uses the existing `workout_sessions` primary key, an ordinary authenticated INSERT, and an immutable snapshot marker containing the request ID and a SHA-256 digest of normalized original evidence. It never uses upsert to overwrite an existing workout. Same-key/different-evidence requests fail, as do malformed or subsequently edited rows.

An existing row is accepted only after an owner-filtered read proves the identity, original snapshot marker, persisted measurements, start time and completion time. If INSERT fails or its response is lost, readback may prove success. If readback is unavailable or no row exists, success is not invented; the original client request remains pending. Optional race-plan enrichment remains the released PR #140 implementation and cannot invalidate a successful primary acknowledgment.

## Device request journal

Native IndexedDB keeps one unresolved manual-run request per owner in `gyms_life_run_submission_v1`. This is a transport journal, not a second workout database: analytics never read it, it stores no credentials, and a matching server receipt permits deletion. A readwrite transaction prevents another tab from silently replacing an unresolved request with a new ID or different measurements. No network write starts before the request is durably retained.

After reload, the same owner's unresolved request is shown with its original data and an explicit retry control. It is not automatically submitted. Fields remain locked while that original delivery is unresolved. Refused or malformed local storage blocks untracked writes, with a visible recovery error. A failed local acknowledgment cleanup does not report an acknowledged server save as failed; subsequent delivery uses the retained ID.

The existing offline identity epoch guards asynchronous work. QuickRunLog is keyed by the authenticated owner. A late response from a previous account cannot clear another owner's journal, update that owner's form, or emit a training-completed event. Server-side owner binding also protects an old request sent with a newly switched token.

A newly acknowledged insert emits the existing completion notification. A replay refreshes Endurance and the containing screen without another training-completed event. These browser events are refresh notifications, not durable accounting; canonical workload remains in `workout_sessions`.

## Bounds

- At most one existing canonical row for repeated delivery of the **same owner/request ID**. Independent request IDs are independent actions, even when the measurements resemble one physical run.
- Cross-device replay works only when it carries the same original envelope. This change does not transport a pending device journal to other devices.
- Clearing browser storage, browser eviction, deletion of the server row, or an unkeyed legacy client is outside durable replay recovery. No tombstone ledger or universal exactly-once promise is added.
- The secondary plan-retry notice is still component-local after primary acknowledgment; persisting that notice is separate work.
- No schema, RLS, privileges, dependencies, production configuration, or real-user data are changed.

## Verification

The new service tests use real supabase-js HTTP construction and a scripted database boundary; they are not live PostgreSQL/RLS acceptance. They cover initial persistence, unchanged replay, post-commit response loss, failed readback and later recovery, concurrent deliveries, changed payloads, ownership, foreign identifiers, unavailable reads, denied inserts, edited records, future times and mismatched receipts.

Nine new Core browser groups use real QuickRunLog, native IndexedDB and controlled synthetic service responses: in-place and reload response-loss recovery, pre-server network failure, invalid receipt, rejected durable storage, failed local cleanup, owner switching, a held late response, and two competing tabs. All existing eight PR #140 run-log groups remain in the full Core suite. No browser assertion is removed to accommodate the change.
