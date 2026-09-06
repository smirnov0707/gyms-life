# GYMS.LIFE Digital Twin Human Asset Provenance

## Purpose

This document records the provenance of the first production visual-human asset used by the GYMS.LIFE Digital Twin renderer.

The asset is **visual representation only**. It must never be interpreted as a body scan, body-composition estimate, physiological measurement, diagnosis or prediction.

## Pinned source

- Upstream repository: `kunalkushwaha/vsim`
- Upstream commit: `3f97faf85e46d2f9a122b0a8b8d3ccc0af598f91`
- Upstream path: `packages/assets/library/man.glb`
- Git blob SHA-1: `bec48c7ad6be753520f7291510c1d63440df87b9`
- Expected size: `2,889,028` bytes
- GYMS.LIFE runtime path: `/models/twin-human.glb`

The first evaluated `human.glb` asset was rejected during visual browser QA because its silhouette/clothing/pose was not suitable as the neutral GYMS.LIFE Digital Human baseline. The pinned baseline was therefore changed to the upstream `man.glb` variant before the photoreal browser-proof change is allowed to merge.

The GYMS.LIFE build does not trust an unpinned moving URL. `scripts/fetch-twin-human-asset.mjs` downloads the asset from the pinned commit and verifies the Git blob SHA-1 and byte length before writing it into `public/models/`.

If download or integrity validation fails, the build remains healthy and the Digital Twin renderer falls back to the canonical schematic analytical body.

## License / provenance chain

The upstream `vsim` asset library documents its MakeHuman / MPFB 2 human assets as MakeHuman output under CC0 (public domain). It also documents that the skin textures are sourced from MakeHuman's `makehuman_system_assets` CC0 pack.

Upstream provenance reference:

- `packages/assets/library/CREDITS.md`
- `docs/asset-packs.md`
- `docs/guides/blender-characters.md`

The asset is used here under its documented CC0/public-domain terms.

## GYMS.LIFE architectural boundary

The visible GLB does not own analytical regions and is not a source of user facts.

The existing GYMS.LIFE analytical Twin mesh remains the stable hidden hit-map for:

- region picking;
- recovery / load evidence mapping;
- selection semantics;
- future overlays.

Both meshes share the same `twin-body-root`, keeping visual motion and analytical picking aligned.

## Future replacement

This asset is an initial neutral visual-human baseline, not the final personalized Twin.

Future versions may replace it with a client-side generated OxiHuman / equivalent CC0 parametric body while preserving the same analytical Twin contracts. Any replacement must receive its own versioned provenance entry and integrity checks.
