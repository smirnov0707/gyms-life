# GYMS.LIFE Digital Twin Human Asset Provenance

## Purpose

This document records the provenance of the first production visual-human asset used by the GYMS.LIFE Digital Twin renderer.

The asset is **visual representation only**. It must never be interpreted as a body scan, body-composition estimate, physiological measurement, diagnosis or prediction.

## Pinned source

- Upstream repository: `nirholas/three.ws`
- Upstream commit: `f641c2d612554d3f8f3b7ee162d4561e75976afa`
- Upstream path: `public/avatars/parametric-base.glb`
- Git blob SHA-1: `652ee3882097d41e7920c7de0454e1c73a94a507`
- Expected size: `6,806,984` bytes
- GYMS.LIFE runtime path: `/models/twin-human.glb`

The GYMS.LIFE build does not trust an unpinned moving URL. `scripts/fetch-twin-human-asset.mjs` downloads the asset from the pinned commit and verifies the Git blob SHA-1 and byte length before writing it into `public/models/`.

If download or integrity validation fails, the build remains healthy and the Digital Twin renderer falls back to the canonical schematic analytical body.

## Why this baseline

Two earlier MakeHuman-derived visual candidates (`human.glb` and `man.glb` from the `vsim` asset library) successfully passed technical browser loading but were rejected by GYMS.LIFE visual QA because their clothing/silhouette did not fit a neutral human-performance Digital Twin.

The selected `parametric-base.glb` is purpose-built from CC0 MakeHuman / MPFB2 source data as a parametric avatar base. Its upstream documentation records:

- CC0 1.0 Universal source body data;
- a 52-joint Mixamo-named skeleton;
- Y-up metre scale and feet on the floor;
- body / eyes / teeth / tongue submeshes;
- baked morph targets for body and facial shape, including macro body parameters.

This gives GYMS.LIFE a neutral anatomical baseline now and a path to later body-shape personalization without replacing the Twin analytical contracts.

## License / provenance chain

The upstream `three.ws` `avatar-sources/anny` documentation states that the source data used to bake `parametric-base.glb` is MakeHuman / MPFB2 core data released under CC0 1.0 Universal. The repository also keeps the source provenance and build script that generates the shipped GLB.

Upstream provenance references:

- `avatar-sources/anny/README.md`
- `avatar-sources/anny/LICENSE.md`
- `scripts/build-parametric-base.mjs`
- `specs/PARAMETRIC_AVATAR.md`

The asset is used here under its documented CC0/public-domain asset terms.

## GYMS.LIFE architectural boundary

The visible GLB does not own analytical regions and is not a source of user facts.

The existing GYMS.LIFE analytical Twin mesh remains the stable hidden hit-map for:

- region picking;
- recovery / load evidence mapping;
- selection semantics;
- future overlays.

Both meshes share the same `twin-body-root`, keeping visual motion and analytical picking aligned.

## Personalization path

The selected GLB already carries a parametric morph-target foundation. GYMS.LIFE may progressively map explicitly available user parameters (for example height and voluntary visual-body settings) into these morph targets while keeping all such changes labelled as a visual approximation.

A future OxiHuman integration may replace or augment the baked morph layer with its client-side WASM engine and measurement-fit workflow. That future integration must preserve the same privacy, provenance and analytical-boundary invariants.
