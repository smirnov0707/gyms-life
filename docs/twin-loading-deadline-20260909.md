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

## Completed verification at `85335248f33e74daf4ee4fdb84927c29402dca82`

All five GitHub workflow groups completed successfully: CI (`34315790340`), Twin browser (`34315790319`), Today browser (`34315790369`), Body replay browser (`34315790305`), and anatomy candidates (`34315790315`). The candidate workflow includes its geometry job and all six Today/Twin × clean/pose/muscular jobs. The complete local Twin browser run also passed all 23 scenarios using an isolated Google Chrome session on the authorized iMac.

The controlled browser regression reproduced the old stage's prematurely cleared deadline, then verified timeout, disposal, ignored late readiness, retry, and manual 2D with the fixed component. This controlled-scene result is separate from the actual WebGL suite. Initial browser-harness failures were fixed by freezing the clock before navigation and finishing held Playwright routes before removing interception; no product assertions were removed.

### Helper-only changes must still trigger the GPU workflows

The extracted `scripts/test-twin-loading-browser.mjs` exposed a path-filter gap: the workflows named only the entry script. Twin pull requests, Twin pushes to main, and candidate pull requests now match `scripts/test-twin-*.mjs`. Two regression checks pin all three path filters and fail against the previous configuration. Jobs, permissions, branch restrictions and production deployment settings are unchanged.

### Remaining visual boundary

Reviewed the native-candidate CI front and mobile side renders against the supplied anatomy reference. Head/feet are in frame in those views, but the colored arm/leg areas remain broad surface regions rather than the reference's individually sculpted muscle forms, and neutral torso detail is less pronounced. This remains an unapproved review candidate, not the shipped model. Successful functional tests do not grant 1:1 visual acceptance.
