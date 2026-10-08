# Generic Body back-selection edge

Base: released PR148, commit 3967daa8504ba53f28b60d913235e3020f303981.

The recorded realistic back selection had hard triangular teeth. Its region primitive used a solid selected material with no boundary mask. Analysis is a different, authored contour/mask surface and is unchanged here.

This increment applies a bounded interior colour feather only to the verified generic Body asset's back region. It derives distances from the existing open edges on a working adjacency graph once on load. Coincident seam vertices share distances but no source vertices are welded or moved. An extra scalar attribute drives the existing opaque material's colour/emission mask. The region interior retains the existing selection colour; the border approaches the original neutral skin. There are no duplicate meshes, extra draw calls, new animation loops, topology changes or added glow. The 0.025 metre width is a presentation parameter on a metre-scale generic mesh, not an anatomical measurement.

The byte-verified registered asset is the scope gate. Other regions, the separate Analysis asset, candidate models and private Identity Shells are not feathered. No physiology, evidence state, canonical region IDs, picking geometry, GLB file, database, dependency or AI provider changes.

## Verification and boundaries

15 unit/integration cases exercise synthetic meshes and the actual registered GLBs. They verify preserved positions/indices/normals/UVs, bounded mask values, a visible full-weight interior, seam handling, malformed inputs and loader scoping. The paired browser test renders the actual Twin fixture at 390/1280px in both themes, with synthetic no-evidence state. Its test-only transform disables the new mask to retain a controlled reference; no such switch exists in the production app. It checks that the mask changes the image without erasing selection, confirms asset identity and preserves absent measurements. Edge-count metrics are descriptive and screenshots require review. Existing full Twin, Today, Core and CI gates still apply.

Local targeted tests and changed-file lint passed using a supplied archived workspace whose loader source matches the reviewed main blob. Local Chromium navigation is policy-blocked; no policy bypass was attempted. Final acceptance must use the exact PR tree in CI, not the archived workspace's complete test count. This is not an anatomical-validation claim, physical-iPhone test or live-account acceptance.
