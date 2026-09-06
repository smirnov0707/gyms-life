# GYMS.LIFE Digital Twin Human Asset Provenance

## Purpose

This document records the provenance of the human figure the Digital Twin
renders, and the licence obligations that travel with it.

The asset is **visual representation only**. It is a generic base mesh, not a
scan of the athlete, and must never be read as a body-composition estimate, a
physiological measurement, a diagnosis or a prediction.

## What ships

- `public/models/twin-human-male-v1.glb`
- `public/models/twin-human-female-v1.glb`
- `public/models/twin-human.manifest.json` — generated, machine-readable
  provenance and measured budget for both files

Both are committed to the repository. The build does not download them, so a
production build cannot depend on a third party staying online, and the exact
bytes that were reviewed are the bytes that are served.

## Source and licence

- Title: **Human Male/Female Basemesh Rigged**
- Author: **Niclas** — https://sketchfab.com/niclas.schoepe
- Source: https://sketchfab.com/3d-models/human-malefemale-basemesh-rigged-96fa14a5a3f0413e98b605e3f65e447c
- Licence: **CC BY 4.0** — http://creativecommons.org/licenses/by/4.0/
- Obligation: the author must be credited. Commercial use is allowed.

The credit is written into `twin-human.manifest.json` by the build script from
a single constant, so the attribution cannot drift away from the file it
describes, and `src/components/twin/twin-human.asset.test.ts` fails the suite
if the manifest loses the licence, the author, or the author's profile link.

## How the shipped files are produced

`scripts/prepare-twin-human.mjs` takes the source glTF — one file containing
both figures side by side — and for each variant:

1. lifts that figure out and disposes the other figure's whole subtree, so the
   rival skeleton is not parsed on every load;
2. prunes and welds, keeping attributes, because the model's UV unwrap is the
   reason it was chosen and a default prune deletes it as "unused";
3. cuts training shorts from the body's own surface, clipped against horizontal
   planes so the hem is a clean line rather than a staircase of triangles;
4. splits the body into one primitive per canonical region, mapped from the
   skeleton's deform bones rather than from coordinates, carrying the region on
   the material name because a glTF primitive has no name of its own;
5. stands the figure on the ground and centres it on the origin **through its
   skeleton**, then measures the result with the same loader the browser uses.

That last measurement matters: a skinned mesh takes its position from its joint
matrices, and glTF says its own node transform is ignored. An earlier version
corrected the node translation and passed a bounds check computed from the same
node hierarchy while three.js drew the figure 0.64 m to the side, out of reach
of every click.

The script is build-time only and is not run by `npm run build`; regenerate the
assets deliberately and commit the result.

## Rejected candidates

Recorded so the same ground is not covered twice.

- **Renderpeople** photogrammetry scans — §4.3.b of their licence forbids making
  the 3D data available in a way that lets third parties download or extract it
  as individual files. Real-time use is permitted; delivery to a browser is not.
- **CC-BY full-body scan (Mike Alger)** — the body mesh spans 136.5–178.6 cm
  only: head, neck and arms. The torso is a sweatshirt and the legs are jeans,
  with nothing underneath, and the GLB carries `morphTargets = 0`, so the
  advertised blendshapes are not in the file.
- **`kunalkushwaha/vsim` `packages/assets/library/human.glb`** — pinned by blob
  SHA-1 and genuinely CC0, but its single texture is MakeHuman's
  `young_caucasian_female_special_suit`: a dark bodysuit with orange trim, a
  face and long hair. The geometry matches — a floor-length skirt, hair cards,
  no visible legs. A Twin has to show chest, abs, quads and glutes, so a clothed
  character cannot serve as the body no matter how good the texture is.

## Architectural boundary

The visible figure and the analytical regions are the same mesh: the region
split is baked into the asset at build time from the skeleton, so what the
athlete clicks is what they see. Region colour is light cast over skin, never a
repaint, and the numeric truth for every region stays in the panel beside the
body and in the 2D map.

## Future replacement

Any replacement asset needs its own entry here, its own licence check, and the
same generated manifest and tests. A future personalised body must not weaken
the rule that the figure is a representation and not a measurement.
