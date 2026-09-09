# Sculpt contour transitions — continuation of PR #55

Continues from committed `796ce5eda6d275deaf51e800a26aee0d2c7fd5d4`. The previously unfinished torso material-support work, its regression checks, regenerated candidate, and favicon fix were preserved before continuing. The snapshot and binary patch are under the local `work/continuation-20260909-torso-seams/` evidence folder.

## Visible changes and their limits

Pectoral and abdominal contours now support bounded rounded-rectangular profiles instead of requiring every lobe to be an ellipse. The pectoral guide is wider relative to its height and the paired abdominal rows are less circular. Exponents are finite and constrained to 2–4; omitted exponents retain the earlier elliptical behavior.

Graphical face ownership and fragment shading now use the same expanded-field competition. Nearby competing regions fade toward neutral before their boundary. This addresses coarse triangle cuts around shoulders, chest, lateral torso and upper back. Rival guides are conservatively culled by bounds, validated and capped at 16 per material; the existing eight-guide limit for a region remains. This is generic artistic segmentation, not medical anatomy or a measurement of a person.

Seam falloff uses a 12 mm shortest-path band on the connected sculpted surface with smoothstep easing. It does not blur across a gap to another hand, limb or disconnected surface. Shared material vertices have identical position/normal data and zero tint. No duplicate skin or overlaid muscle shells are introduced.

The eight canonical region data contracts, recovery/volume/session calculations, queries, source failures and unknown-evidence behavior are not replaced. Graphical triangle ownership can change with these authored contours; it must not be confused with a new physiological inference.

Current candidate SHA-256: `e94fdf6acf09bf82285d4797a5abef26e2928516ecb5e3a97aad78c32491ca31`; 1,725,412 bytes, 45,792 triangles and 22,898 welded vertices. Maximum relief remains 7.48 mm; no protected native vertex is displaced. The neighboring machine-readable reports remain authoritative for exact values.

## Review and verification

The reproducible exact-input builder and its existing topology, orientation, stretch and exact-GLB intersection gates remain mandatory. Shared-vertex triangle pairs remain outside the intersection audit. No tolerance was weakened. The candidate's neighboring audit, intersection and Khronos reports bind to its SHA-256, as do browser and render artifacts.

The diagnostic renderer now records neutral and colored **full-body and torso-close-up** front/side/back views. Close-ups are deliberately cropped camera views, not proof of full-body framing. Each view records its framing and triangle count alongside the exact asset hash. CI retains both the original native baseline and sculpt review output.

Tests cover finite/default profile parameters, bounded competition metadata, shader variants, mirrored field ownership, rival-culling completeness, surface-geodesic weights against an independent shortest-path reference, protected points, exact material-seam normals/masks, binary reproduction and camera framing. Full application browser suites and all candidate matrix jobs still have to pass on the submitted commit.

The candidate remains opt-in in the Today and Twin test fixtures. The production asset and earlier native/clean/pose candidates stay unchanged. `visualGatePassed` and `productionIntegration` remain false: muscle shape, fiber-direction transitions and final reference fidelity still need visual review. No main merge, Supabase change or production deployment is part of this block.
