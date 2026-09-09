# Bounded native muscle sculpt — review candidate, not production promotion

Continues from `6528d589025e49584014435abeb50fe8fcbe0d92` on PR #55.

## Actual visual work

The pinned CC0 native candidate is retained unchanged. The new `sculpt` fixture adds 25 mirrored art-direction lobes covering pectorals, shoulder heads, upper/lower arms, abdominal rows, obliques, back, glutes, quadriceps, hamstrings and calves. These are generic presentation guides, not anatomical segmentation validated against a scan and not measurements of an athlete.

A conforming refinement adds detail only around muscle surfaces. The new exterior has 45,800 triangles and 22,902 welded vertices; the original has 26,576 triangles. Relief is limited to 12 mm by contract and reaches less than 8 mm in this export. Original head, hands, feet and central pelvis are protected. The builder checks topology, winding, triangle rotation/stretch and protected positions before exporting. No disconnected muscle shells, garments or duplicate overlay skin are added.

The first normal recomputation exposed facets on the refined surface. The kept version preserves smooth native normals and differentiates the bounded relief; unchanged areas retain native shading. A denser second-refinement experiment did not clear the existing exact-file intersection audit and was rejected. Its failed reports remain in the local authoring evidence, not in the registered candidate. No audit tolerance or rejection condition was relaxed.

Per-fragment analytic contours replace coarse vertex-only lobe boundaries. Per-region guides are bounded and validated before shader compilation; uniform arrays are capped at eight. The candidate carries original presentation coordinates in `_TWIN_SCULPT_POSITION`. Both analytic contour phase and the existing antialiased fiber renderer are decorative presentation, not measured fiber directions. Existing assets stay on the non-contour shader path.

Canonical eight-region picking, recovery/volume/session semantics, null evidence and asset provenance remain in the existing shared renderer. No physiological calculations or user records are changed.

## Reproduction

```sh
node scripts/authoring/sculpt-native-muscle.mjs \
  tests/twin-browser/assets/twin-anatomy-muscular-candidate.glb \
  /absolute/path/outside-public/sculpt-review

node scripts/authoring/render-sculpt-review.mjs \
  tests/twin-browser/assets/twin-anatomy-sculpt-candidate.glb \
  /absolute/path/outside-public/sculpt-renders

TWIN_ANATOMY_CANDIDATE=sculpt npm run test:browser
TWIN_ANATOMY_CANDIDATE=sculpt npm run test:browser:today
```

The renderer starts a loopback-only server on an available port. On the authoring iMac, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to the installed isolated Chrome executable. CI installs its own Chromium. Diagnostic renders are actual GLB/WebGL output with synthetic region colors, clearly labelled; they are not concept images or screenshots of real athlete data.

## Bound evidence

Candidate SHA-256: `21198a588a4a8f60fbebf2dc1e8e83110f1977bdcaad7cbe9390133e9c9a820a`; 1,711,668 bytes. Source SHA-256: `5e965ec985c6eca556bf9059a707c259bcf3c7f7f0802f2388e4051fb4d03158`.

The exact exported GLB audit reports zero detected nonincident intersections, zero coplanar ambiguities, zero duplicate/degenerate triangles. **Shared-vertex triangle pairs are excluded**, so this is not proof that every possible intersection is absent. Khronos validator `2.0.0-dev.3.10` reports zero errors and warnings; its nine informational UV notices concern coordinates consumed by the custom renderer.

Regression tests bind authoring/intersection/format reports to these exact bytes, reproduce the binary, check finite unit normals and canonical regions, enforce mirrored/bounded fields, reject invalid shader guides, and add full-body projection checks for this candidate. The candidate workflow adds sculpt to both Today and Twin and runs an exact sculpt-geometry gate before its browser matrix.

## Visual boundary

Front/side/back comparisons have been rendered in neutral material and synthetic region colors. Lobe separation is now visible in the upper/lower arms, abdominal rows and lower limbs rather than one continuous colored arm/leg region. Some upper chest/shoulder material boundaries and the idealized reference's muscular volume still need refinement; these are not a 1:1 visual pass. The figure remains a generic authored body, not a personalized photoreal scan.

The production `public/models/twin-anatomy-v1.glb` and all earlier review candidates remain unchanged. Keep `visualGatePassed` and `productionIntegration` false; PR #55 remains draft and no production deployment is authorized by these technical results.
