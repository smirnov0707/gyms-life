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

## Rights record (private operator assertions, not automatic licence verification)

Required fields: `assetSha256`, `creator`, `sourceUrl`, `licenseName`,
`evidenceReference`, and `permissions` with `commercialWebApp`,
`browserDelivery`, `publicRepository`. Each permission must explicitly be
`approved`; do not substitute a commercial-rendering licence for SaaS or
redistribution permission. An operator must actually inspect the source and
licence evidence before recording approval. Keep invoices, private agreements,
customer details and private asset files outside this public repository.

This first intake is for assets permitted in the current public-repository
pipeline. A privately licensed model with no public redistribution permission
needs a separately reviewed protected-delivery design; it must not be uploaded
here merely because the renderer can load it. URL hiding is not DRM.

## Source research (checked 2026-09-06; not a purchase or blanket legal clearance)

- MakeHuman core assets/exports: CC0 per the official FAQ. Third-party clothes,
  skins and animations still require individual source/licence checking. This
  is a viable unrestricted authoring base, not a promise of scan-level realism.
  https://static.makehumancommunity.org/makehuman/faq/can_i_sell_models_created_with_makehuman.html
- Renderpeople free rigged humans: scanned, retopologized, UV/textured and
  skinned per their official download page. Free models use the same terms as
  paid models. Terms 4.2(c) restrict some SaaS implementations and 4.3(b) restricts
  easily accessible individual files. Obtain written permission covering the
  specific GYMS.LIFE web delivery before selecting this route.
  https://renderpeople.com/free-3d-people/
  https://renderpeople.com/general-terms-and-conditions/
- Three.js r180 GLTFLoader source is the compatibility reference, not latest
  documentation alone. A future adapter should preserve PBR maps, check nearest
  visible-surface picking and dispose owned image bitmaps/resources correctly.
  https://github.com/mrdoob/three.js/blob/r180/examples/jsm/loaders/GLTFLoader.js

## Blocking asset decision

No licensed, inspected photorealistic adult sport-clothed GLB has been selected
or shipped in this change. Do not add a fake URL, repaint the current mannequin,
or use a stock business-person scan as an accepted fitness character.

Next needs the actual approved asset including UVs, albedo/normal/roughness,
clothing, face/hands and rig where applicable. Bind only the canonical eight
region IDs, with head/eyes/hair neutral; do not infer physiology from geometry.

After asset preparation, integrate into the EXISTING scene behind a reversible
preview-only switch. Natural skin first; separate subtle overlays second.
Run complete CI and browser regressions, inspect actual front/back/both sides/
face/hands/overlay views, then obtain owner visual approval. Production remains
unchanged until that approval. No claim of completed Phase 3C is warranted by
this intake tooling.
