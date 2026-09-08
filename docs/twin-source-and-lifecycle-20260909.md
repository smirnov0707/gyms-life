# Twin model source and lifecycle continuation

Work continues from `86f03757efb08700890f230fc9dd3fd7767a9dc4` on PR #55. That revision's five GitHub workflow groups completed successfully before this block started. Production deployment is not part of this block.

## Correct source for the visible body

The previous `TwinStage` credited BodyParts3D regardless of which GLB the test harness served. `BodyReplay` did not pass that credit at all, despite loading the same model. Loading placeholders, manual 2D, and generated fallbacks could also inherit an unrelated source label.

The shared loader now verifies the actual downloaded GLB bytes against the registered SHA-256 fingerprints before parsing. Registration distinguishes the shipped atlas, the two BodyParts3D review candidates, and the native MakeHuman candidate. A candidate registration is not visual approval and does not promote its asset to production.

The model returns its verified provenance through the scene lifecycle. `BodySceneStage` owns the visible attribution for both Twin and session replay. Loading and 2D views do not credit a model they are not showing. A generated 3D fallback is labelled as simplified and does not borrow a source. Review candidates have a separate translated status line. The cockpit credit wraps rather than relying on an ellipsis and hover title.

## Cancellation and failure

The scene's AbortSignal is passed to `fetch`. Status, declared size, actual binary size, GLB header, and registered digest are checked before parsing. The 8 MiB size check is a parsing guard, not a streaming network-byte limit. Each registered asset is self-contained; no remote texture or model discovery is performed.

Cancellation is checked before fetching, after reading, after hashing, and after parsing. A parsed model that arrives after cancellation is disposed. The fallback handler checks the destroyed flag so an abort rejection cannot revive an unmounted scene.

The fallback screenshot also exposed a cropped head: its geometry is taller than the atlas default. Both loaded and generated bodies now use the same actual-geometry framing function; a projection test covers the fallback at three aspect ratios and four yaw angles.

## Verification and remaining boundary

`npm run test -- src/components/twin/twin-body.provenance.test.ts` covers all four exact assets, altered/invalid responses, source selection independent of URL, failed responses, cancellation propagation, and disposal after cancelled parsing. The Twin browser suite checks source/hash/status, absence of stale credit during loading and 2D, explicit fallback, and recovery. Session replay has its own visible-credit regression.

The full CI, Twin, Today, replay, and candidate-browser workflows remain required before integration. Local browser evidence uses synthetic fixtures, not athlete measurements. No user records, health calculations, production model bytes, or production settings are changed by this block.

When an asset is intentionally rebuilt, rerun its geometry/format/visual review, update the registered digest deliberately, and run the evidence-binding tests. An unregistered file falls back instead of acquiring a guessed source. Visual 1:1 approval remains a separate unfinished review.
