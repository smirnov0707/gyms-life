# Natural Twin and mobile navigation

The full My Twin viewport now follows the small viewport height, with a 220 px floor on short phones and landscape screens. The existing resize observer refits the same model when the available space changes. Today and detail stages retain their own size constraints.

A swipe beginning on the canvas scrolls the page by default. A tap still selects a visible region. “Control 3D” / “Valdyti 3D” explicitly enables orbit, tilt and two-finger pan/zoom; “Done” / “Baigti” restores scrolling. Desktop drag, keyboard navigation and camera buttons remain available. Wheel scrolling also belongs to the page until 3D interaction is enabled.

`public/models/twin-natural-v1.glb` is a new, separately registered generic MakeHuman CC0 presentation model. `node scripts/authoring/build-natural-twin.mjs` reproduces it from two pinned existing assets. It retains the refined triangles and all eight region material assignments, restores the smooth native positions/normals beneath the added sculpt relief, and applies a smooth, symmetric chest depth reduction of up to 26 mm. It does not modify the old assets, personal Identity Shells or BodyParts3D Body view. Decorative fiber stripes are disabled. Selection contour masks and the existing Body back feathering remain.

The exact static GLB audit is recorded beside the browser assets: no nonincident intersections, coplanar ambiguities, duplicate or degenerate triangles. This audit is a geometry check, not medical or anatomical certification.

Breathing is a visual resting cycle of five seconds, independent of athlete measurements. A small ribcage/abdomen morph (under 3.2 mm on the shipped model) leaves the head, hands and feet fixed. Smooth morph normals follow the deformation. Three.js uses the same morph positions for rendering and raycasting. There is no whole-body pulsing or inferred respiratory rate. Reduced motion and the ambient-motion switch set the morph to rest; hidden/offscreen rendering still suspends. Authored personal-shell animation is not overwritten.

Verification includes exact asset hashes, raycasts at rest and inhalation, region picking, viewport rotation, native canvas-origin scrolling, explicit gesture mode, rendered breath frame differences, reduced motion, and Chromium/WebKit screenshots. Trusted one-finger/two-finger gestures are tested in Chromium. Playwright WebKit lacks a trusted swipe API, so its checks cover native keyboard/wheel scrolling, computed touch behavior, layout and rendering; these do not claim physical iPhone validation.

The existing production release gate remains unchanged. Integration commits use `[skip netlify]`; only a separate verified-tree `[release production]` commit publishes. No database or service writes are involved.
