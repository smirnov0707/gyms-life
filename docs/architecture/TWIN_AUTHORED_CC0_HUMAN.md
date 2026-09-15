# Authored CC0 generic human — review candidate

## Ownership and input provenance

The owner explicitly requested zero paid models or services. The authored asset uses only selected MakeHuman core **graphics** under CC0 plus GYMS.LIFE's original authoring recipe. It does not bundle MakeHuman application logic, UI icons, proprietary scans, private contracts or user photos. The pinned core revision is `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`.

Official graphics license: https://static.makehumancommunity.org/about/license.html

Official system-pack license listing: https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html

The system archive must match SHA256 `b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107`. Each consumed geometry/target/texture is hashed in `asset-manifest.json`. A CC0 notice accompanies the generated GLB. Upstream filenames describe selected authoring assets; they are not inferred user characteristics.

## What is authored

- A generic adult template using explicit, versioned shape weights rather than an invented personalized body.
- UV-preserving subdivision of the reference body, then region-border-preserving simplification.
- Graphite sport shorts with an authored surface offset, small fabric folds and procedural fabric texture. Covered pelvis faces are removed from this candidate's skin surface.
- A natural nonmetallic PBR skin material with core albedo and authored subtle microdetail. This is not a physically accurate subsurface-scattering implementation.
- Fitted core eyes and short hair; no new neural generator or paid service.
- Eight canonical broad body-region identities attached to actual renderable triangles, including the garment regions. Neutral head/eyes/hair remain in the raycast occlusion list, not region data.

The recipe is `scripts/human/build_cc0_human.py`; the optimizer uses the repository's existing pinned meshoptimizer. Export is a self-contained GLB with no external texture references. Inspect the generated manifest for its actual size, hash and triangle counts rather than copying an earlier candidate's numbers.

## Existing application integration

Keep the existing `mountTwinScene`, orbit/zoom, lazy loading, visibility management, region inspector and 2D fallback. The optional human asset is another presentation input, NOT another intelligence model. `TwinSnapshot`, the AI orchestrator, workout calculations and Supabase are unchanged.

`VITE_TWIN_HUMAN_PREVIEW=true` is a public presentation flag for preview builds only. It is not a secret or authorization mechanism and remains off by default. Do not enable it in production before owner visual review. Normal app builds retain the previous schematic renderer.

Natural skin is the default preview appearance. The optional evidence-colour toggle applies a restrained tint while preserving the albedo; it does not introduce another data layer. Recovery and logged-volume retain their own existing meanings. Missing/unavailable evidence remains unknown. A natural-looking body never means healthy or recovered.

The asset owns its loaded geometries, materials and textures. Layer/appearance changes do not recreate the canvas or reset the camera. Failed loading, malformed data and WebGL context loss must keep the accessible 2D information path.

## Verification and acceptance

Run typecheck, all unit tests, lint, production build, the existing Twin browser harness and `scripts/test-human-browser.mjs`. The human harness uses labelled synthetic data in the existing component, not a new production route or authentication bypass. Collect real front/back/side/mobile images and a 360 recording. Script success is not visual acceptance.

Keep these separate:

- File generated.
- Candidate committed to a branch.
- Technical checks passed for that exact candidate.
- Screenshots actually reviewed.
- Owner visually accepted.
- Production enabled.

The draft status or an intermediate CI pass must never be presented as completion of all those steps. A local machine or software GPU benchmark is not a physical iPhone/Safari/Android measurement.

## Current limitations

This candidate is generic, not a user scan or body-composition estimate. It uses static authored geometry with the existing decorative micro-sway, not a skinned skeletal animation, measured breathing or heart rate. No blink animation, personalized face or physiologically driven body transformation is claimed. Photographic realism still requires actual visual acceptance; a valid GLB or many triangles do not prove it.

Body Replay changes under their own concurrent PR must be integrated carefully; do not overwrite that shared-stage work. A separate concurrent headless-authoring workflow is an asset experiment, not a second approved application renderer. Select one validated application asset and leave discarded experiments out of the production dependency path.

Rollback of the appearance is disabling the preview flag or reverting the presentation commit through a reviewed PR. No user-data rollback is required.
