# Twin continuous surface

## Purpose

This presentation-only follow-up to Phase 3A replaces the separated oval/lathe
mannequin with one connected generic human surface. The existing 360-degree
camera, controls, region selection, evidence inspector, reduced-motion handling,
2D fallback and canonical recovery calculations remain unchanged.

The body is locally authored generic geometry, not a user scan, anatomical
measurement, body-composition estimate or prediction of future appearance.
A smoother silhouette must never imply finer physiological evidence. Both sides
of each body group still share the same existing source value.

## Asset pipeline

`node scripts/generate-twin-surface.mjs` evaluates the authored implicit surface,
extracts triangles, smooths the surface and simplifies it offline. Region borders
are locked during simplification. Tiny disconnected sampling islands are removed
only within a strict one-percent limit. Oppositely oriented duplicate triangle
pairs created by collapsed spurs are removed as zero-volume geometry within a
0.1-percent limit; other duplicates fail. The generator verifies closed manifold
edges and consistent orientation before writing an asset.

The versioned output is `src/components/twin/twin-body.surface.json`. Position
quantization is in generic scene coordinates, not measurement accuracy. The
output can be redirected with `TWIN_SURFACE_OUTPUT` for reproducibility tests.
The generator is build/test tooling, never imported into the product browser.
`meshoptimizer` is pinned as a development-only dependency.

The browser's existing lazy Three.js module unpacks the baked positions and
indices. Normal vectors are computed once across the whole outer surface, then
shared between region meshes. There are nine display meshes: eight existing
body groups and one neutral surface. This avoids both disconnected joints and
independent normal seams while preserving the existing nearest-surface picking
contract. Disposal is idempotent and frees the geometries and materials.

## Limits and validation

Generation fails above 24,000 triangles, 15,000 vertices or 210,000 gzip bytes
for the geometry JSON. These are asset limits, not whole-application limits or
a claim about phone frame rate. The final lazy renderer bundle also contains
Three.js; its transfer size must be checked separately in build output.

The geometry unit tests verify deterministic regeneration, valid finite indexed
data, bounds, closed connected topology, consistent winding, shared unit normals,
eight representative front/back/side raycasts and repeated disposal. The existing
browser harness tests the real TwinSnapshotView with labelled synthetic fixtures:
360-degree orbit, drag versus selection, zoom, keyboard, unknown data, context
loss/retry, 2D fallback, StrictMode lifecycle, touch emulation and reduced motion.
Tests do not use a real user's health data or bypass production authentication.

Required release checks:

```sh
npm ci
npm run typecheck
npm run test
npm run lint
npm run build
npx playwright install --with-deps chromium
node scripts/test-twin-browser.mjs
```

The reproducibility check runs in the unit suite using a temporary output path.
No repository-writing asset generation workflow is part of the final release.
Inspect actual front/back/side browser screenshots before merging; passing mesh
and interaction tests alone does not establish visual quality.

## Explicit limitations

This remains a stylised, generic body, not the final high-fidelity personal Twin.
Only the existing recovery layer is wired. No additional health data, predictions,
biometrics or new Supabase tables are introduced. Physical iPhone/Android GPU,
battery and authenticated production interaction testing are separate checks and
must not be claimed from Chromium touch emulation alone. Pre-existing repository
security advisories and lint warnings are not resolved by this change.

## Rollback

Reverting this presentation PR restores the earlier geometry without modifying
user data or the database. The existing manual 2D switch remains available.
