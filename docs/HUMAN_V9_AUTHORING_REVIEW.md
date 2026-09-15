# Digital Human v9 authoring review

Status: review candidate only. No runtime replacement, main merge, or production eligibility is granted by this build.

## Why v8 retained orange anatomical lines

The exact v8 GLB (`6eea1173fae1ed970b5f911e256922004709d5ffc5d71b46b21cbf9bb72683ff`) binds body material `young_caucasian_male_detailed` to the embedded image named `young_caucasian_male_special_suit`. That image is JPEG, even when extraction tools save it with a `.png` filename. Its SHA-256 is `b51d52f75de2f53cc241e7a15f2ae0ce6b423b92b6a5ebf381a847e5031456da`.

Replaying the v8 image transformation and JPEG settings on the clean special-suit diffuse reproduces those embedded bytes exactly. The exporter did not select a different diffuse or ignore the edit. The `.mhmat` has `wireframe False`; the orange marks are painted into the diffuse image.

The defect is in the v8 mask: orange pixels are excluded from the initial warm-skin classification, but `MaxFilter(9)` and `GaussianBlur(2.0)` subsequently spread nearby warm-pixel protection back over the guide lines. About 97.4% of original orange pixels receive more than 50% preservation; the median preservation is 100%. The orange-pixel predicate counts 112,713 original pixels and 107,565 in the decoded v8 JPEG. The former hardcoded `wireframe_removed: true` claim is contradicted by the embedded texture and the front, back, side, hand and mobile renders.

## What v9 changes

1. Recreate the exact v8 body parameters, modifiers and high-poly eyes from pinned `makehuman-core` revision `06e129ac920593f9f315e03d6d5b3f843504de7f`.
2. Export OBJ/MTL first. Find the material assigned to the most OBJ faces and resolve its actual exported `map_Kd` to an existing output-local file. Reject ambiguous or missing maps rather than searching for similarly named source files.
3. Segment the graphite suit on that exported diffuse. Restrict segmentation to the actual connected OBJ UV island, preventing adjacent dark scalp pixels from joining the suit mask. The garment owns its entire interior; feathering cannot restore guide artwork.
4. Use the pinned `middleage_caucasian_male` diffuse outside the garment. Both materials use the same HM08 body UV atlas, 2048 × 2048 images and no UV override. This supplies head, neck, hands and feet; visual UV fit still needs review.
5. Write the resulting diffuse and neutral microdetail normal, then rewrite MTL references. Neither cloth albedo nor normals retain gradients from the original guide art. Re-read the JPEG and fail if any orange guide pixels remain inside the garment mask.
6. Convert the authored OBJ/MTL to GLB and verify the exact embedded image hash. Compare positions, normals, UVs, triangle indices and scene structure with the saved v8 fingerprint. No separate clothing shell is created.

The v8 geometry baseline is a small JSON fixture derived from the audited binary. It remains usable after old GitHub artifacts expire and contains no visual acceptance claim.

## Reproduction

Use Python 3.12 with `pillow==12.3.0` and `numpy==2.3.5`, Node 22, and the repository and authoring lockfiles. The workflow `.github/workflows/human-cc0-build-v9.yml` runs the complete build, texture/geometry audit, Khronos validation and render capture. `scripts/human/toolchain` is isolated from application dependencies.

```sh
python scripts/human/build-v9.py --source /path/to/pinned/makehuman-core --out /path/to/review-v9
npm ci --prefix scripts/human/toolchain --ignore-scripts
node scripts/human/toolchain/node_modules/obj2gltf/bin/obj2gltf.js -i /path/to/review-v9/gyms-digital-human-v9.obj -o /path/to/review-v9/gyms-digital-human-v9.glb -b --secure --checkTransparency
python scripts/human/audit-authored-textures.py /path/to/review-v9/gyms-digital-human-v9.glb --reference-fingerprint scripts/human/fixtures/v8-geometry-fingerprint.json --body-image-sha256 HASH_FROM_SOURCE_MANIFEST --report /path/to/review-v9/texture-geometry-audit.json
node scripts/human/validate-glb.mjs /path/to/review-v9/gyms-digital-human-v9.glb /path/to/review-v9/gltf-validation.json
node scripts/human/render-review.mjs /path/to/review-v9/gyms-digital-human-v9.glb /path/to/new-render-directory --extra-full-body
```

`render-review.mjs` extracts the unchanged studio HTML/JavaScript from the original v8 workflow. The eight canonical captures keep the same angles, camera, lights, exposure, desktop 900 × 1200 and mobile 390 × 844 viewports, and device scale factor 1. Those cameras already crop parts of v8; an additional mobile full-body image is explicitly separate. The manifest hashes both studio code and candidate bytes. Render existence never sets `visualGatePassed` to true.

## Local technical result

- GLB SHA-256: `b4b05544adbff0d0ca8bb159330e031ccc917e8f31a4100a2a8bd08ccb6e1b38`.
- Size: 1,681,796 bytes; v8 was 2,170,212 bytes.
- Embedded diffuse SHA-256: `354c31eb02e70accbbc33f1e2a13aa72a73d12f1d03732aa76377d08bdfa0fb4`.
- 28,796 triangles, two meshes/primitives: one body plus eyes. No rig or animation.
- All geometry attributes and indices are byte-identical to v8. Geometry fingerprint: `79d1155084e231f477fb8ff08f0283724c8831c98a6a6b5ece5a1f70aa1a13ce`.
- 106,415 original guide-colored pixels occur inside the topology-restricted garment mask; zero remain after JPEG encoding. This predicate is a diagnostic, not a claim that every visual defect is absent.
- Exact texture/geometry audit passes both direct-GLB and saved-fingerprint comparison.
- Official Khronos validator `2.0.0-dev.3.10`: zero errors and one retained `MESH_PRIMITIVE_GENERATED_TANGENT_SPACE` warning. The unchanged body has no baked tangents; this is accepted only for the isolated review candidate, with actual-renderer portability still pending. Any other warning fails the validation script.
- The local in-app browser cannot create a WebGL context. Canonical screenshot evidence is therefore produced in GitHub Actions, as it was for v8.

## Gates that remain separate

Human review must assess the face and eyes, donor skin transitions, wrists/ankles/neck, cloth appearance, silhouette and mobile composition. Unchanged geometry proves that this iteration introduces no clothing layer intersections; it does not prove absence of every inherited mesh self-intersection. Physical mobile performance, interaction-region mapping, app material behavior and actual runtime integration require later verification. The current main application has evolved since this authoring branch; do not merge the entire historical branch to integrate an asset.

The generic CC0 base is not a personal scan, body measurement or claim about an athlete's identity. Source hashes and provenance remain in `SOURCE_MANIFEST.json`. All build and audit output keeps visual acceptance and production eligibility false until the visual gate is explicitly passed.

## Completed CI capture and visual decision — 2026-09-08

Build/audit/render run [34235338663](https://github.com/smirnov0707/gyms-life/actions/runs/34235338663) passed at `eac4eb2520300f284b5d63ce433a7de45a7c9127`. All eight canonical images and the extra full-body mobile image were captured and inspected. The rendered CI binary is `4a9ed814f835e3be0036ba21af79cd1396a4b0d236c353ebb162d2ad428091e6` (1,690,728 bytes). Its diffuse, normal JPEG and geometry equal the local build byte-for-byte; PNG compression differs across platforms, but decoded eye/mask pixels are identical. The CI artifact, audits and render manifest all bind the same CI GLB hash.

**Visual gate: FAIL.** Orange anatomical artwork is visibly absent in all views and no obvious clothing-layer intersections appear in this static pose. Two independent visual reviews found the remaining blockers: the suit reads as painted/latex body rather than fabric, face/eyes remain waxy or glassy, fingertips/nails are angular, and the rear collar has a stepped edge with a central bump. Retain the successful texture correction and single body surface; work on cloth response, skin/eye appearance and garment boundaries before another visual gate. Do not integrate v9 into main.

General CI [34235585821](https://github.com/smirnov0707/gyms-life/actions/runs/34235585821), Body Replay browser [34235585881](https://github.com/smirnov0707/gyms-life/actions/runs/34235585881) and Twin browser [34235585841](https://github.com/smirnov0707/gyms-life/actions/runs/34235585841) passed at code head `380d317edca1e57e255c5481fed736d1050b8ef2`. That final code commit fixes only existing Prettier formatting in four older authoring files, with unchanged syntax trees. None of these browser checks approves the v9 asset's realism or physical-mobile performance.
