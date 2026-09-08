# Digital Human v10 — material-only review

Status: review candidate, NOT visual approval and NOT a runtime replacement.
Continues the v9 work in draft PR #35. Do not merge this historical authoring
branch wholesale into current main. No application, analytical Twin, data,
region picking, fallback or production files are changed in this slice.

## Changes

The v9 donor swap removed the original visible eyebrows and hair. V10 restores
the verified original face/brows/hair within the actual, face-seeded head UV
component (including a small sampling gutter). It does not classify dark pixels
as a head: topology must select exactly one above-neck component. The remainder
keeps v9's guide-free skin and garment masks. A neck colour transition remains a
visual review item; the restoration is not proof of seamlessness.

The body now embeds a linear metallic/roughness map: green is roughness, blue is
zero metallic. Cloth and skin no longer share one scalar response. The factor
is one, otherwise it would multiply the map and lower its authored values.
Subtle textile normal detail is lossless PNG, independent of the old guide art.
The existing eye material receives a less glassy roughness setting. Eye diffuse,
alpha mode, body/eye geometry, UVs, indices and transforms remain unchanged.
This is not new hair geometry, subsurface skin scattering, corneal optics, a
clothing simulation, a personal scan or a claim about the athlete's body.

## Why two review modes exist

The legacy v8 studio overrides every body's roughness to 0.64, normal scale to
0.18 and environment intensity to 0.40, and every eye's roughness to 0.12.
That is useful as a frozen historical comparison, but not an assessment of the
GLB's own material settings. The old runner and workflow remain untouched.

`render-material-review.mjs` reuses the exact same runner and changes only the
single known override block in an isolated temporary workflow. It refuses an
absent or duplicated block. Cameras, lighting and exposure are unchanged.
Its manifests explicitly label authored-material mode and hash both source and
effective inputs. It does not call the temporary workflow a legacy comparison.
Both v9 and v10 run in this mode so a lighting/material-mode switch cannot be
mistaken for an asset improvement. Legacy v10 captures are retained separately.

Each mode captures eight inherited reference angles plus the separate full-body
mobile frame. Existing camera cropping is retained for historical comparison.
No screenshot or load-time result grants physical-mobile performance approval.

## Reproduction and gates

Use Python 3.12, Pillow 12.3.0, NumPy 2.3.5, Node 22 and the existing lockfiles.
First rebuild v9 with `build-v9.py` and its pinned MakeHuman revision, then:

```sh
export V9_REVIEW_DIR=/path/to/verified-v9-review
python scripts/human/test_build_v10.py
node scripts/human/render-material-review.mjs --self-test
python scripts/human/build-v10.py --v9 "$V9_REVIEW_DIR" --out /path/to/new-v10-review
```

The builder accepts only the two documented v9 local/CI binary hashes. Decoded
source and mask hashes are pinned too. An unexpected baseline fails rather than
silently authoring a different human. The workflow rebuilds the pinned v9, so it
does not depend on the continued availability of a GitHub artifact.

The new workflow independently runs the existing exact texture/geometry audit
against the saved v8 fingerprint and the existing official Khronos validator.
The inherited no-baked-tangents warning is not suppressed or relabelled fixed.
Render manifests and the asset manifest keep visualGatePassed and
productionEligible false. Owner acceptance, actual-runtime material/region/
fallback verification and physical-device measurements remain separate gates.

## Results recorded before CI capture

Local candidate SHA-256:
`f12336759ebb444502edcb2ab7232dea9bccf981cc858ede84a7aae2f4a42247`.
Size: 3,605,412 bytes. Geometry: unchanged, 28,796 triangles.
15 regression tests and 3 review-mode transformation checks passed locally.
Independent Khronos/geometry CI validation and rendered visual acceptance are
not claimed by these local tests. CI results must identify their actual SHA.

Unfixed in this slice: inherited angular fingertips, collar geometry/boundary,
texture-only hair silhouette and the broader photorealism gap. A successful
technical run cannot promote the candidate to production.
