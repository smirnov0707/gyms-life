# Endurance race-plan sync recovery

The workout session remains the canonical training record. Recording it and enriching its race-plan association are separate outcomes. A deferred enrichment returns a saved session ID, preserves its training credit and exposes a retry action in QuickRunLog.

## Boundaries

- `retryEnduranceRaceSync` authenticates through the existing middleware and accepts only a workout session UUID. Ownership and completed-run checks use the authenticated client before any privileged write. Run measurements are reread from storage, not supplied by the retry caller.
- Synchronization never inserts a workout session and never edits duration, distance or workload. Existing confirmed links are retained, including links to an older goal.
- Automatic assignment uses compare-and-set on empty association fields and the observed run measurements. The existing unique `(user_id, endurance_race_goal_id, endurance_plan_session_key)` index arbitrates competing runs. A zero-row update or uniqueness collision is not success: reread the owned run once and accept only a committed link.
- Ambiguous evidence still requires the existing separate athlete confirmation. Retry is not consent.
- If downstream analysis fails after a successful match, retain the match and report the insights phase as deferred. Diagnostic logs include a bounded error code, phase and session ID, never raw database row/error messages.
- Presentation refresh failure does not turn a successfully saved run into a failed primary action. Sync retry emits only the endurance update event, not another training-completed event.

## Verification

The new service tests use the real supabase-js request builder against isolated HTTP responses. They verify ownership filters, compare-and-set filters, successful and failed writes, conflict handling, retained associations, original local run day and safe repetition. They are not live PostgreSQL concurrency or RLS acceptance tests.

`node scripts/test-endurance-sync-browser.mjs` exercises the real QuickRunLog with synthetic services in Chromium and WebKit, including repeated activation, retry failure, optional consent, refresh failure and Lithuanian 320px layouts. The dedicated workflow retains results and screenshots even on failure. Production is not touched by this workflow.

## Deliberate limits

This is saved-session enrichment recovery, not exactly-once manual activity submission. A transport failure before the original save response reaches the browser still needs a separate durable submission idempotency key. The retry notice is component state, not a durable retry queue, and does not survive a full page reload. There is no background retry scheduler. Existing adaptation-ledger auditing retains its own fail-open logging behavior. No database migration, RLS policy or privilege changes are introduced here.
