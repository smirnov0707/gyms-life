# Larger Twin and vertical navigation

Based on released main 656f4a6c (PR149); the separate PR150 surface refinement is not replaced.

The full My Twin body canvas receives more height on phones and desktop. Today cockpit and muscle-detail sizing remain unchanged. The actual loaded body is fitted without stretching, inventing measurements, or changing anatomy. Camera pan and zoom let the athlete inspect upper/lower regions rather than shrinking the entire experience to keep every detail above the fold.

One-finger drag rotates horizontally and changes elevation vertically; polar limits prevent an upside-down camera. Two-finger drag translates the view vertically and pinch changes distance. Mouse right-drag provides vertical pan. The target remains on the body's axis and within bounded fractions of the loaded mesh's height. Two persistent 44px buttons provide an alternative to gestures in the full view.

The existing disclosure retains front/back/side views, zoom and reset, and gains upper/lower-body presets plus tilt buttons. Presets retain the current side. Canvas keyboard: left/right rotate; up/down pan; Shift+up/down tilt; +/- zoom; Home resets target, pitch, yaw and distance. Modified shortcuts/IME are not captured.

Selection, not camera motion, updates the region. Multi-touch, drag and cancellation are never treated as a tap. Near-side picking uses the vertical body-axis plane so a raised or tilted camera does not reject visible lower limbs due to distance from the former target. Dropdown selection still focuses the actual region bounds. Selection does not fabricate a health reading.

No physiology, database, authentication, AI provider, dependency, GLB, personal texture or lighting changes. The background micro-sway, reduced-motion behavior, offscreen suspension and 2D fallback remain.

Acceptance: focused geometry/policy tests, actual WebGL navigation, native pointer/right-drag, trusted Chromium two-finger pan and pinch, LT mobile/EN desktop at 320/390/1280px in both themes, measured larger rendered skin area against a same-scene old-size reference, unchanged evidence and full existing CI/Today/Twin regressions. A software-rendered Chromium fixture is not a physical iPhone GPU test.
