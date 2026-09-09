# Account-scoped offline workout persistence

## Scope and lineage

This continues the single foundation candidate PR #61 from `760155eb995a70ad982ba4e95ee3f324604201bb`. It is not another stacked release branch. The existing model, plan, nutrition, AI and foundation availability work is retained. No production deployment, production/staging database migration, payment action, model request or real account modification is part of this block.

The former array under `gyms_life_offline_queue_v2` had no owner field. Reads could show another account's pending sets, synchronization relied on whichever session happened to be active, and two tabs could replace each other's entire array. A successful HTTP response was also treated as acknowledgement without checking the actual returned execution values.

## New storage contract

New queued sets use native IndexedDB `gyms_life_offline_v3`, with a `pending` object store indexed by `ownerId`. Each immutable execution record has a schema version, unique item ID, authenticated UI owner ID, original action time and the exact set input. No access/refresh tokens are stored in this database. The owner association is required at every public queue entry point; there is no anonymous/default queue read or write.

Read/write transactions atomically enforce the 200-item per-owner limit and deduplicate identical execution inputs. Independent rows are not overwritten by a shared-array snapshot. Different values for the same logical set remain separate pending records until a verified server result can resolve them; no last-writer-wins overwrite is used.

Storage opening and transactions have their own bounded waits; refused cross-tab notification support cannot change an already committed save into a failure. A local save is reported only after the transaction completes, not when the first insert request succeeds. Aborted, blocked or denied storage is surfaced as unavailable/refused, not an empty history. A malformed owned record remains stored and raises an incomplete-read indication; it is not silently discarded. Valid independent records can still synchronize, while completion cannot assume that an unreadable queue is empty.

Pending mutations retain the foundation's `networkMode: always` behavior, so the local branch runs while the browser is offline. New server sessions and completion still require connectivity and an explicit action rather than a deferred automatic mutation.

## Identity changes and tab coordination

The actual AuthProvider updates a process-local identity epoch before publishing a new user. Sign-out, another account, or A → B → A invalidates older scopes; a same-user token refresh does not discard valid work. Each asynchronous operation checks its captured scope before storage/network boundaries and before consuming a reply. React workout state and the pending-data panel remount with the account key. Late success/error messages from an old mounted identity are ignored.

New offline synchronization requests contain an expected owner. The server compares it with the **verified authenticated context**, before any database access. The expected ID is an extra denial condition, never the authority used to choose a user. Ordinary start/log/finish actions also accept this guard, while their existing server-side ownership checks remain authoritative. The authenticated client middleware itself was not modified.

BroadcastChannel notifications contain only a change signal; each subscriber reloads its own indexed records. They do not publish another account's sets. Where Web Locks is available, a non-queued cross-tab sync lock avoids redundant submissions. Without that API, IndexedDB transactions plus server-side uniqueness/exact acknowledgement still preserve data. The code does not promise that HTTP delivery is globally exactly-once. An already transmitted request cannot be unsent; after a timeout or identity change the local item is retained unless a valid acknowledgement was already transactionally committed.

Each request is bounded to 20 seconds and a batch to a 45-second network budget. Undelivered records remain for a later explicit/reconnect retry. A slow or hung provider does not delete data or indefinitely block the UI's identity transition.

## Server acknowledgement and conflicts

The ordinary plan-checked set write was extracted into `set-log.service.ts` without replacing its validation or uniqueness rules. The new offline endpoint checks authenticated owner, session, logical set and the stored values. An acknowledged reply binds owner ID, client item ID, server set ID, exercise/series identity, reps, load, RPE, completion flag and performed time. Localized display names are not treated as a change to the performed exercise.

Only a matching typed acknowledgement can remove the matching owner/item row. That removal and its legacy recovery receipt update happen in one local transaction. A boolean success, missing body, wrong owner/item, different values, unconfirmed write or failed local transaction is not a successful synchronization. An exact existing row can acknowledge a lost reply even after the session has finished, without reopening that session. A missing set in a finished session remains pending for review instead of modifying completed history.

The offline path does not quietly redate old records. Times outside the current server-accepted window remain pending with `performed_at_review`. Conflicting values, unavailable sessions and invalid old measurements are retained with a review explanation. There is no automatic overwrite/discard button masquerading as synchronization. More advanced user-mediated conflict reconciliation is a separate product action.

## Previous-version recovery

Both legacy keys, including `.unreadable`, are read-only to the new implementation. It never writes, clears, renames or overwrites those bytes, even when a row or the entire JSON is malformed. The old parser's destructive shared-array/salvage writers were removed from the current public API.

Recovery is initiated by the explicit account-check button or as part of the user's Start/resume action. It sends only a bounded list of session IDs to an authenticated ownership lookup. It imports only sessions the server confirms for that account; unmatched rows are not assigned to the next login. A failed lookup, wrong returned owner, unexpected session ID or intervening identity change performs no adoption. Unverified workout names/values are never shown in the ordinary current-account panel.

A SHA-256 digest identifies the legacy row content, including its original ID, timestamp and parsed set values. Import and a `recovery` ledger entry commit together. After acknowledgement, the receipt prevents the still-preserved source row being imported again. Reusing an old row ID with changed execution values gives a different digest. Corrupt entries and backups remain available in their original location. Very large sources are bounded (200 distinct parsed rows per inspection, 2 MB per source); a limited read is not represented as complete recovery.

This preservation statement is about the new code: an old pre-upgrade tab, manual storage clearing, an OS/browser eviction or a user deleting browser data can still change/remove storage. Deployments should ask users to refresh older open app tabs. IndexedDB transaction completion and a strict durability request are not a backup guarantee against a device loss. Local owner filtering is an application isolation boundary, not encryption against a person with browser developer tools or same-origin script execution. A full account-erasure/export policy must include local pending and recovery stores.

## Acceptance evidence

The dedicated browser suite uses the actual AuthProvider, real IndexedDB, real tabs and actual browser network toggles. Account identities and HTTP endpoints are explicitly synthetic and loopback-only. It covers account A/B transitions and reload, concurrent appends/capacity, identical versus conflicting set submissions, normal and absent Web Locks, wrong/empty acknowledgements, in-flight identity changes, aborted imports, denied transactions, corruption, BroadcastChannel UI updates and LT/EN 320px display.

Server tests exercise the real new service layer over controlled Supabase replies: expected-owner refusal occurs before queries, every lookup is owner-scoped, exact existing writes can be acknowledged, conflicts/time reviews are retained, and missing/failed queries never become success. This is not a claim of logging in two real Supabase users or proving all production RLS configurations.

Existing workout and Today browser tests now seed/read the native owner-specific store rather than assuming v2 is automatically owned. They retain capacity, storage refusal, offline action acknowledgement, six-set completion, replay/AI/meal behavior and both browser-engine coverage. Earlier raw queues remain separately verified as unchanged in the new recovery suite.

## Rollout and remaining gates

No production schema dependency is added by this block; the new service uses existing tables/constraints. The earlier foundation's production schema blockers and migration-ledger reconciliation remain open, so this is still a draft release candidate. No live payment configuration was enabled or changed.

Before production acceptance, exercise a real test-account start → lose signal → record → switch account → return → synchronize → finish → history path against the reviewed staging build, and include actual mobile devices. The synthetic tests do not certify hosting authentication, email delivery or physical device persistence. Production Night Lab execution, live AI recommendation quality and final visual acceptance remain separate steps.

## Reproduction and primary API contracts

- `npm run test:browser:offline` runs the new native storage suite. Use `CORE_BROWSER_ENGINE=webkit` for WebKit; CI runs both engines independently.
- `npm run test:browser:core` retains the existing workout/nutrition/voice tests.
- `npm run test:browser:today`, `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build` are also required for the candidate.

Native transaction semantics: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB

Cross-tab sync coordination: https://developer.mozilla.org/en-US/docs/Web/API/Lock

Auth event boundary: https://supabase.com/docs/reference/javascript/auth-onauthstatechange

Exact-head CI IDs, final test counts and downloaded artifact verification belong in the PR completion comment and `work/continuation-20260909-offline-identity/` handoff.
