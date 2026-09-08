# Digital Human v10 — material-only review

Status: technically verified review candidate. **Visual gate: FAIL.**
This is NOT owner approval and NOT a runtime replacement. Continues the v9
work in draft PR #35. Do not merge this historical authoring branch wholesale
into current main. No application, analytical Twin, data, region picking,
fallback or production files are changed in this slice.

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
The existing eye material receives an explicit roughness setting of 0.38:
rougher than the legacy studio's 0.12, but smoother than v9's native 1.0.
These are three different settings, not evidence of improved eye realism.
Eye diffuse, alpha mode, body/eye geometry, UVs, indices and transforms remain
unchanged. This is not new hair geometry, subsurface skin scattering, corneal
optics, a clothing simulation, a personal scan or a claim about an athlete.

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

Each batch captures eight inherited reference angles plus the separate full-body
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

The workflow independently runs the existing exact texture/geometry audit
against the saved v8 fingerprint and the existing official Khronos validator.
The inherited no-baked-tangents warning is not suppressed or relabelled fixed.
Render manifests and the asset manifest keep visualGatePassed and
productionEligible false. Owner acceptance, actual-runtime material/region/
fallback verification and physical-device measurements remain separate gates.

## Verified CI and exact artifact — 2026-09-08

Code head: `407b354a140c8840c303183721ed87aca5192d25`.
Implementation commit: `f8d742bef3a76e32c476dedb7e9c6c6b4bb1baca`.
The second commit fixes job-level runner context initialization and two
formatting errors found by the first CI attempt; no candidate pixels changed.

Build/audit/render run [34258493033](https://github.com/smirnov0707/gyms-life/actions/runs/34258493033)
passed, including all 15 Python regression tests and the three review-mode
transformation guards. The independent geometry/texture audit passed all eight
checks. Official Khronos validator 2.0.0-dev.3.10 reports zero errors and one
retained `MESH_PRIMITIVE_GENERATED_TANGENT_SPACE` warning. The warning still
requires actual-renderer portability review before any integration.

Exact CI GLB SHA-256:
`f12336759ebb444502edcb2ab7232dea9bccf981cc858ede84a7aae2f4a42247`.
Size: **3,605,412 bytes**, identical to the local candidate. Stored geometry:
**28,796 triangles**, one body surface and eyes, with unchanged position,
normal, UV and index data. There is no new clothing shell, rig or animation.

Actual embedded diffuse SHA-256:
`e12cb4359841fe41feb578acc428dee04b54e8304f8baece9df65c15f45c2b1f`.
The encoded diffuse retains zero guide-coloured pixels inside the garment
mask. This narrow diagnostic does not certify the absence of all visual defects.

The downloaded artifacts were checked against the asset and render manifests:

- `gyms-digital-human-v10-review`, artifact `10068979747`.
- `gyms-digital-human-v10-renders`, artifact `10068980695`.
- 27 actual PNG captures: nine legacy-v10, nine authored-v9, nine authored-v10.
- Both v10 render batches bind the same GLB hash as the independent audits.
- Authored-v9 and authored-v10 have the same effective studio hash:
  `c6e2c269f139d46552b16d4b9fdbbe36ba8f463a2ab008e2ac30b6a99230f5ed`.
- Artifacts are retained for 30 days. Their manifests are evidence for a specific
  binary and mode, not automatic visual or production acceptance.

General [CI 34258499119](https://github.com/smirnov0707/gyms-life/actions/runs/34258499119),
[Body Replay browser 34258499194](https://github.com/smirnov0707/gyms-life/actions/runs/34258499194)
and [Twin browser 34258499143](https://github.com/smirnov0707/gyms-life/actions/runs/34258499143)
all passed for this code head. These PR workflows test the synthetic merge with
main; they do not demonstrate integration of the v10 asset into the runtime.
This later documentation-only update does not create a new asset build.

## Rendered visual decision

**Visual gate: FAIL.** This is a useful intermediate improvement, not the
requested final photorealistic human. All three capture batches were inspected
as contact sheets, with the authored face, hands, back and full-body mobile
views also examined individually.

Visible gains: original dark eyebrows and hair texture are restored; the
previous near-bald/eyebrow-free regression is resolved. Fine textile structure
is visible in close views, and the authored-mode garment is matte rather than
the strongly glossy result produced by the legacy preset. However, v9 is also
matte in authored mode: the legacy-to-authored difference must not be presented
as entirely a v10 improvement. Like-for-like v9/v10 full-body changes are modest.

Remaining blockers: the suit still follows a smooth bare-body silhouette and
lacks convincing garment folds/boundaries; the face remains pale/waxy and eyes
synthetic; hair is painted texture, not strand geometry; rear collar retains its
stepped central bump; fingertips remain angular. A deterministic normal/roughness
map cannot by itself close these geometry and appearance gaps. No obvious new
clothing-shell intersection appears in this static pose, but that does not
certify the inherited mesh or future deformation states.

The transfer size increased from the 1,690,728-byte v9 CI file to 3,605,412 bytes.
It remains below the review's 8 MiB cap, but this is not a phone performance test.
Before future integration, the next visual pass must address the collar and
hand detail, cloth appearance and face/eye response, then repeat the same
comparison conditions. Retain the head-restoration and guide-removal guards.
Keep this PR draft; main, production and user data have not been changed by this
iteration. Owner visual acceptance remains outstanding.
