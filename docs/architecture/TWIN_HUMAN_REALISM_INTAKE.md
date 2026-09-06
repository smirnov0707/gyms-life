# Human realism: asset intake before renderer changes

## Inspected baseline

Pinned read: `94b51d30e36f6638882cc56b524125d9bac7c093` (2026-09-06).
The existing renderer uses Three.js 0.180.0 directly. `createTwinBody()` reads
baked positions and indices, calculates normals and makes grey, partially
metallic MeshStandardMaterial regions. It creates no UV attribute or skin
texture. New lights or more triangles cannot substitute for a human asset.
Keep the continuous surface, orbit, selection, mobile cockpit and fallback.
PR #34 separately changes session replay/shared-stage integration: do not
replace that work with a parallel renderer.

## What this change actually implements

An offline, bounded GLB metadata intake command, with synthetic regression
tests. No application import, runtime behaviour change, model download,
external network request, new dependency or backend/schema change.

```sh
node scripts/audit-twin-human-asset.mjs /private/candidate.glb /private/rights.json /private/report.json
```

The report records the actual file SHA-256, byte length, stored primitive
triangle count, UV/material references and declared rig/animation counts.
It checks chunk/buffer boundaries, external image/buffer references, the
8 MiB transfer target and 100,000 stored primitive triangle target. Extension
use is deliberately a review blocker until the actual asset and decoders
are tested. This does not ban future KTX2/Meshopt support.

This is NOT the Khronos glTF Validator, a decoder test, a topology validation,
a verified legal opinion, a performance benchmark or a realistic human.
Stored primitive triangles are not per-frame rendered triangles: node reuse,
instancing, shadows and additional passes need runtime measurement. Image
headers/pixels are not decoded. Draw calls, FPS, GPU memory and decoded
texture sizes are explicitly null. Visual and production acceptance are
always false. A triangle fixture can pass metadata without being a human.

Exit 0: metadata preflight passed AND the exact-file rights record is complete.
Exit 2: readable report, but one or more intake gates remain unmet.
Exit 1: invalid input, read/write error or unsupported container structure.
Existing output files are never silently overwritten.

## Rights record (operator assertions, not automatic licence verification)

Required fields: `assetSha256`, `creator`, `sourceUrl`, `licenseName`,
`evidenceReference`, and `permissions` with `commercialWebApp`,
`browserDelivery`, `publicRepository`. Each permission must explicitly be
`approved`; do not substitute a commercial-rendering licence for SaaS or
redistribution permission. An operator must actually inspect the source and
licence evidence before recording approval. Keep invoices, private agreements,
customer details and private asset files outside this public repository.

## Zero-cost asset decision

Owner decision on 2026-09-06: Phase 3C must use no paid human model. The
selected authoring path is therefore **MakeHuman / MPFB core CC0 assets only**.
The official MakeHuman Community licence page states that core graphical assets
(base mesh, targets, skins) are CC0, and the official FAQ states that exported
models may be copied, modified and distributed, including commercially. MPFB's
FAQ likewise states that models made from its core assets can be used in a
closed-source product. This is the appropriate zero-cost legal baseline for a
GYMS.LIFE-owned derivative human asset.

Authoring rule: use only core/bundled CC0 graphical assets whose status is
confirmed by the official MakeHuman/MPFB licence documentation. Do not silently
pull third-party community clothes, skins, hair, poses or scans into the model:
those may have separate licences and must pass the same exact-file rights gate.

Official evidence checked 2026-09-06:

- https://static.makehumancommunity.org/about/license.html
- https://static.makehumancommunity.org/makehuman/faq/can_i_sell_models_created_with_makehuman.html
- https://static.makehumancommunity.org/mpfb/faq/can_i_sell_models.html
- https://static.makehumancommunity.org/mpfb/faq/is_it_really_free.html

MB-Lab is explicitly NOT the default authoring source: its model/database
licensing is materially different and can propagate AGPL obligations to 3D
output. Do not mix MB-Lab assets into this CC0 pipeline.

## Target asset we will author

Create a neutral adult athletic human rather than downloading a stock person's
scan. It must not claim to be the user's measured body. Target characteristics:

- believable adult anatomy and neutral athletic proportions;
- natural face, hands and feet rather than mannequin primitives;
- UV-mapped skin with albedo/base-colour, normal and roughness information;
- non-metallic skin material and restrained studio lighting;
- neutral non-sexualised athletic presentation;
- rig only where it improves subtle idle motion without harming mobile cost;
- GLB delivery prepared for the existing Three.js r180 scene;
- target <= 8 MiB initial mobile transfer and <= 100k stored triangles, measured
  after the authored model is exported and optimised rather than assumed;
- canonical GYMS.LIFE region mapping remains chest/back/shoulders/arms/legs/
  glutes/core/abs; head, eyes and hair remain neutral data-wise.

The final GYMS.LIFE asset may be materially edited and optimised from the CC0
base: proportions, topology/LOD, textures, materials and neutral sports styling
can be authored specifically for this product. Photorealism is a visual target,
not a claim that the geometry is a real person's scan.

## Integration architecture

Do not replace the current Twin business model. The intended flow remains:

`TwinSnapshot -> TwinSceneState -> existing Three.js scene -> human appearance + overlays`.

The realistic surface is appearance. Canonical region hit areas/overlay mapping
are a presentation adapter. Neither may calculate recovery, volume or health.
Unknown evidence remains unknown. The existing procedural surface stays as a
fallback until the authored human passes technical and owner visual acceptance.

Integrate behind a reversible preview-only switch first. Preserve the same
OrbitControls instance, 360-degree horizontal orbit, zoom, keyboard controls,
mobile gestures, selected region, 2D fallback and reduced-motion semantics.
Do not remount the canvas when changing intelligence layers.

## Acceptance sequence

1. Author/export the CC0-based human and record the exact GLB SHA-256 plus the
   official CC0 evidence in the rights manifest.
2. Run the checked-in intake tool against that exact file.
3. Render a natural-human layer first, with no data heatmap.
4. Map the eight existing canonical regions without increasing evidence
   granularity. Picking must use the nearest visible surface or a verified
   deforming proxy; never allow front regions to be selected through the back.
5. Add subtle transparent data overlays while preserving skin readability.
6. Run full typecheck/test/lint/build and Twin browser regressions.
7. Measure transfer size, triangles, draw calls and frame timing on the actual
   asset; do not infer them from authoring settings.
8. Capture front/back/left/right/three-quarter/face/hands/natural/overlay review
   evidence and request owner visual acceptance.
9. Only after visual acceptance consider enabling the new human for production.

## Current gate

The zero-cost legal/source decision is now resolved, but the actual authored GLB
is not yet checked into this branch. The intake tooling and this architecture
note are not a completed realistic renderer. Production remains unchanged until
the real authored asset, runtime adapter, browser/performance validation and
owner visual acceptance all exist.
