# Continuous anatomy review candidate

This builds an isolated, continuous exterior for visual review. It never writes `public/`, never approves visual similarity, and does not replace `twin-anatomy-v1.glb` or change application data semantics.

## Source and license

The registered source is [BodyParts3D 4.0](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html), using the official 99%-reduced OBJ archive and IS-A element table:

- [OBJ archive](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip), SHA-256 `40665852c49f218326590e204db91064a1ecfc3c6f8cbd7bbbcaac62c7cd409e`.
- [Element table](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_element_parts.txt), SHA-256 `a3de74423f943b0d724ae8f59b3a817f87c423a544f8db98113b1980817cbeaf`.
- [CC Attribution–Share Alike 2.1 Japan license](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html). Retain the attribution: “BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan”. Adaptations remain subject to the source license.

`FJ2810.obj` is skin as an anatomical organ: its header reports 3,443 cm³. Its mesh contains both sides of the skin and cannot be used unchanged as a solid exterior. `exterior.mjs` retains faces whose positive-normal rays escape toward the exterior, removes disconnected parts, and caps the resulting aperture rings. The audit records the removed faces, cap locations and dimensions. The source data is not downloaded by the builder.

## Reproduce

Use the repository's installed dependencies (`npm ci`), then pass all four arguments explicitly. `OBJ_DIR` must be the extracted directory containing `FJ2810.obj`; `OUTPUT_DIR` must be outside `public/`.

```sh
node scripts/authoring/build-continuous-anatomy.mjs \
  /absolute/path/to/gyms-life \
  /absolute/path/to/isa_BP3D_4.0_obj_99 \
  /absolute/path/to/isa_element_parts.txt \
  /absolute/path/to/anatomy-review-output
```

The builder emits `twin-anatomy-continuous-candidate.glb`, `anatomy-candidate.audit.json`, and `source-selection.json`. Expected runtime is about one minute on the authoring machine. The audit compares the candidate with the repository's current `public/models/twin-anatomy-v1.glb`; it does not modify that file. It fails the process when the exact exported topology or canonical-region checks fail. Khronos format validation and GPU visual review are separate checks.

## Geometry and renderer contract

The candidate uses the original skin silhouette with superficial-muscle correspondence from 86 selected source files. It has a bounded inward relief of at most 4 mm; it does not inflate separate muscle shells. The pubic surface is closed and smoothed, head/hands/feet are protected from muscle displacement, and remaining authoring residue is welded at 0.05 mm. Cap centres have a 0.01 mm offset to avoid degenerate fans. Normals are computed on the whole exterior before splitting material regions. Positions remain Float32 so quantization cannot open material seams.

There is one primitive per canonical `twin-region:*` material, including neutral. The eight muscle regions retain `TEXCOORD_0` and `twinFiberUV: true` in both mesh and node extras. `uv.u` runs along the presentation fibers, and `uv.v` is their phase across the region. Chest coordinates curve horizontally; arms and legs use longitudinal cylindrical coordinates. Cylindrical wrap seams duplicate UV vertices with identical positions and normals. Neutral head/hands have no fiber UV. The coordinates are procedural presentation charts, **not validated anatomical fiber directions**. The GLB requires `KHR_mesh_quantization` for its compressed normals.

Use an integer cycle count with `sin(uv.v * 2π * cycles)` so the unwrapped cylindrical phase remains periodic. Custom-only UVs produce eight informational `UNUSED_OBJECT` messages in the Khronos validator; they are required by the opt-in application shader.

## Current evidence and remaining work

The first repaired candidate has SHA-256 `50c847e66c5cc37bced5104a3644128d726dcec8d7f76e07127f04cf91bc4adc`: 103,042 triangles, 51,523 welded vertices, one edge-connected exterior, no boundary edges, non-manifold edges/vertices, duplicate triangles or degenerate triangles. Its Euler characteristic is 2. The file is 1,927,728 bytes. Khronos `2.0.0-dev.3.10` reported zero errors and zero warnings.

These checks establish connectivity and file validity. They do not establish absence of every geometric self-intersection, anatomical fidelity, mobile performance, or a visual pass. Aperture caps around hands, eyes, armpits and the groin require close visual review. The atlas subject's proportions remain; the 4 mm relief cannot reproduce the reference's idealized pectoral volume or distinct six-pack. Region boundaries are projected source correspondence, rather than independently sculpted anatomical separations. No personal body measurements or physiological percentages are inferred by this build.

The next authoring decision must follow the same front/back/side/close-up GPU renders. A stronger sculpt can reuse this exterior and named superficial source parts, with closest-triangle correspondence, gradual bounded displacement, paired left/right landmarks and per-step triangle-orientation rejection. Head, hands and joint clearances should remain fixed. Per-muscle UV charts should follow reviewed insertion/origin landmarks before claiming anatomically directed fibers. Keep the reviewed cleanup candidate intact for comparison; no automatic visual or production gate should be added.

## Separate pose and upper-thigh classification experiment

`build-anatomy-pose.mjs` takes five explicit arguments: `REPO CLEAN_GLB OUTPUT_DIR SOURCE_OBJ_DIR SOURCE_SELECTION_JSON`. It requires clean SHA `50c847e66c5cc37bced5104a3644128d726dcec8d7f76e07127f04cf91bc4adc`, rejects output in `public/`, and refuses to overwrite its input. `reclassify-thighs.mjs` verifies named source-part hashes and relabels only the former broad groin-mask faces using actual source correspondence.

The candidate applies symmetric 8° hip abduction with 6° relative knee counterrotation, grounded feet, and continuous pelvis/joint blending. Head/hands stay fixed. Its global oriented triangles and existing regional UV coordinates are preserved. The classification change deliberately moves some triangle ownership from neutral to legs/abs; new faces receive compatible region UVs. The script fails on triangle inversions/degeneracy, altered topology, lost UVs or oriented triangles, moved head/hands, failed region raycasts, or non-grounded feet. It is generic visual authoring, not a personal prediction.

The first pose/classification candidate SHA is `78f9290273242756b0f12299a5ae490f953e23788668b6dd8d4c11e557e9cba9`, with a 28.71 cm ankle-slice centre proxy. Its pubic-cap orientation repair is at most 1.014 mm, but one local triangle reaches approximately 3.02× area and a normal rotation near 86°; review this closely in the GPU render. No muscular volume was added. Flat chest/abs relief and projected material borders remain visual limitations. Keep the original clean asset for comparison and leave visual/production gates closed.

## Native muscular continuation: exact-file validation and framing

The native candidate remains isolated in `tests/twin-browser/assets/`; it is not the production atlas. The preserved local pose recipe uses upper-arm world-Z rotations of −20°/+20°, forearm world-X rotations of 48°, and upper-leg world-Z rotations of −3.5°/+3.5°.

The earlier committed GLB `8cefec6f8561530193d77af27bf0f8c29ffc937cba8576e38165351dacc8e571` has two intersecting nonincident triangle pairs under the exact-file audit. The continued pose export `5e965ec985c6eca556bf9059a707c259bcf3c7f7f0802f2388e4051fb4d03158` has zero detected nonincident intersections and zero coplanar ambiguities under that same audit. Both have 26,576 triangles. These are numerical observations, not visual or anatomical approval.

```sh
node --test scripts/authoring/audit-native-glb.selftest.mjs
node scripts/authoring/audit-native-glb.mjs \
  tests/twin-browser/assets/twin-anatomy-muscular-candidate.glb \
  test-results/native-geometry/intersections.audit.json
```

This audit reads positions, indices, and world transforms from the exact bytes it hashes. It welds exact coincident material-seam positions, rejects unsupported animated/skinned/morphed or non-Float32 geometry, and fails closed on coplanar ambiguity. Shared-vertex triangle pairs are excluded explicitly: passing does not prove those incident faces are intersection-free. The former NPZ-based authoring diagnostic is not the CI acceptance gate.

The candidate-browser workflow now reruns the exact-GLB audit before its browser matrix. Unit tests also reject stale topology/intersection report fingerprints. Keep `visualGatePassed` and `productionIntegration` false until a separate review authorizes promotion.

`createTwinCameraFrame` measures the actual loaded mesh, including node transforms, and fits its per-vertex vertical/radial profile for all horizontal yaw angles at the initial and reset pitches. It accounts for perspective depth, not just a flat 1.70 m height rectangle. It does not rescale or reshape the asset. All vertices of the production atlas and three candidate GLBs are projection-tested at three aspect ratios, sixteen yaw angles, and both home pitches. Deliberate close-up zoom and non-home pitch can still crop the figure by design.

The adjacent `.validation.json` is a freshly generated Khronos `2.0.0-dev.3.10` format report for the same native GLB. Its SHA, error count, and warning count are checked by the evidence-binding tests; it does not grant visual approval. A persistent local Today preview can remain on port 4183 while the full test suite runs with `TODAY_BROWSER_PORT=4185 node scripts/test-today-browser.mjs`. The override remains loopback-only and rejects invalid port numbers.
