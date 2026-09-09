# Twin loading deadline and retry isolation

Continues PR #55 from `ada76768d96a5e99bab0263360de2d972e5517e3`.

The previous stage cleared its 15-second watchdog when the renderer mounted, not when a body became ready. The runtime also has a 20-second generated-surface timer: the previous ordinary stalled download was not an infinite wait. The defect was the missing end-to-end deadline and an abandoned request remaining able to replace the timed fallback later.

`createTwinSceneAttempt` now owns the dynamic import, scene handle, deadline, readiness and disposal. Renderer attachment does not clear the deadline. Readiness does; timeout, failure and unmount release the owned scene, whose existing disposal aborts its model fetch. A late import cannot mount a scene after cancellation. Late body/failure callbacks cannot revive an old attempt or interfere with a retry.

Timeout now keeps the 2D evidence map and offers a retry with its own deadline. English and Lithuanian copy distinguish a slow load from a WebGL/device failure. Promptly rejected or unverifiable assets retain their explicitly labelled generated fallback; registered asset fingerprints, source credits and model bytes are unchanged.

## Verification

Eleven deterministic lifecycle tests cover deadlines across import and download, disposal, retry isolation, context failure, synchronous callbacks and fallback provenance. A mutation that deliberately cleared the timer on renderer attachment was rejected, then the fixed source was restored. Existing asset-loader tests verify AbortSignal propagation and cancellation after parsing.

The Twin browser harness adds three real-component scenarios: a held model request, a held runtime import, and manual 2D during loading. They check that old work cannot revive the scene, source credit is absent in 2D, and retry restores exactly one verified model. The scenarios run in the existing production and anatomy-candidate workflow matrix with synthetic fixtures only.

Local typecheck, 1,129 tests in 147 files, lint (zero errors, 27 existing warnings), and production build passed before submission. GPU/browser and full CI evidence must be inspected for the resulting commit; local unit results alone do not certify those checks.

No production deployment, merge, Supabase change, physiological calculation, asset promotion or visual signoff is part of this change. PR #55 remains draft.
