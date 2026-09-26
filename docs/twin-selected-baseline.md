# Selected Twin presentation baseline

The user identified the September 26 sculpt render as the intended Twin.
The earlier assumption that they meant the separate BodyParts3D screenshot
was incorrect. Continue from this selected surface and preserve its region map.

The public review asset `public/models/twin-selected-v1.glb` is byte-for-byte
identical to the selected sculpt input, SHA-256
`e94fdf6acf09bf82285d4797a5abef26e2928516ecb5e3a97aad78c32491ca31`.
No geometry, contour, mask, material-name or muscle assignment was rebuilt.
The periodic fiber shader from PR #87 remains unchanged.

Today and My Twin start in Muscles/analysis and load this selected asset through
the normal application loader. Body/realistic continues to load the separate
body shell and remains available for personalized identity rendering. This
branch retains the selected asset's review-candidate status; identifying the
model does not itself approve production deployment or complete UI fidelity.

Browser tests check the exact downloaded GLB hash on both screens, preserve the
Body/Muscles round trip, and retain selection, camera, fallback, mobile and
source-error checks. Three unedited screenshots from the synthetic route fixture
are emitted by the Today CI job for inspection and retained in its artifact.
