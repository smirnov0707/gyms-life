# Body Replay: recorded session quantities on the shared 360 body

Baseline: main `1c225fd019a3e68cfc2b7064e9c65db3078e8bfb` after PR #33.
This is a fresh source-reviewed implementation, not an unverified application of
an earlier local ZIP. The obsolete source-export workflow is removed.

## Contract

Only `done === true` records count. Set count is not muscle activation, effective
sets, stimulus, growth or recovery. Volume is the registered external weight ×
repetitions. Missing/negative/unsupported inputs withhold a whole group's volume,
not its completed count. An explicitly recorded zero external weight remains 0;
it is not evidence of zero effort. Unsafe aggregates withhold percentages too.

Unmapped exercise records remain in a named non-anatomical `__unassigned__` bucket.
`mappingStatus` distinguishes no catalogue match from catalogue query failure.
The server reads `.error`, ignores any accompanying stale catalogue rows, and
returns the completed records without distributing them across body regions.
Other groups remain visible when only one group's volume is incomplete. A failed
catalogue read does not prevent an otherwise valid workout completion.

No Supabase migration, raw log modification, recovery-formula change, new AI
provider, personalized anatomy or persisted session-state model is introduced.
The completed-screen `BodyReplay({ contributions })` interface stays compatible;
`volumeKg` becomes nullable and optional mapping metadata is added to the response.
The old relative-volume helper remains only for compatibility, not UI claims.

## Reuse

`BodySceneStage` owns the one lazy renderer lifecycle, 360 controls, selection,
loading/failure handling and 2D fallback. `TwinStage` is the canonical Twin adapter;
`BodyReplayView` projects session contributions directly through
`session-replay.model.ts`. No manufactured TwinSnapshot or recovery percent is
used for a session. Session layers have distinct `session_sets` / `session_volume`
identities. Blue tones are relative thirds of the largest listed quantity in the
chosen layer. They are presentation bins, not a physiological comparison.

Changing data, layer, locale or selected region updates the existing scene handle;
only renderer mode/retry changes remount it. The initial front/back preference
seeds orientation without resetting free orbit on every React update. Local
44px targets, Escape focus, mobile reflow and the existing theme tokens remain.

## Gates

Run normal CI: `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build`.
Run the unchanged Twin browser regression harness and the new
`node scripts/test-body-replay-browser.mjs` on the final head or merge candidate.
The new read-only workflow publishes screenshot and JSON artifacts. It checks
layer/canvas/camera agreement, 2D, incomplete/unassigned/unavailable/empty evidence,
actual WebGL context loss and retry, StrictMode cleanup, touch pinch, 320px LT,
390px EN, larger text and unsupported WebGL. Fixtures are synthetic and never
query user records or bypass authentication. Screenshot generation is not itself
human visual review; that gate must be recorded separately.

## Known limits

This is a completed-session summary, not per-set timed playback or a history
browser. Completed-session retries rebuild replay from stored logs. Catalogue
mapping is current, not an immutable historical exercise taxonomy. Recorded
volumes are rounded to whole kg × reps as before. Physical-phone Safari/GPU,
battery and authenticated production completion require separate validation.
Dependency advisories and existing lint warnings are not resolved by this change.
Do not claim production publication until the actual Netlify commit is verified.

## Completion retry and failure semantics

The authenticated server function delegates to one finish-workout service.
A completed-session retry reads that user's persisted logs and rebuilds replay;
it does not consult the current plan, rewrite finished_at, or repeat decision/
timeline side effects. A lost conditional-update race re-reads the owner-scoped
session and succeeds only if a completed winner is confirmed.

Required completion validation and persistence errors still reject the request.
Optional catalogue, replay validation and follow-up failures cannot make a saved
workout appear unsaved. Replay source failure is an explicit replayStatus, shown
as unavailable in the completion UI, never an empty-success or zero-work claim.
The retry control uses the same authenticated, now idempotent finish endpoint.
Its last confirmed source status remains unavailable during pending/failed retries.
Catalogue failure retains the known records in an unavailable mapping bucket.
No database migration, raw-log rewrite, outbox or exactly-once delivery claim.
Follow-up failures use sanitized operational codes and are not durably retried.

The service regression suite scripts the Supabase query boundary. It is not a
live database, RLS penetration test, or real concurrent-request stress test.
