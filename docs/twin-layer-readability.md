# Twin layer readability

Continue from released main a7a8c6983d6b1fe534884f088521fc8fb44e7f21.

The three equal-width columns split Lithuanian words at 320px. The shared TwinLayerControls now uses intrinsic-width wrapping: visible labels are Atsistatymas / Tūris / Šiandien or Recovery / Volume / Today. Full localized layer names remain the accessible name and title; units, calculation descriptions and layer IDs are unchanged. At enlarged text sizes an entire control can move to a new row instead of clipping a word. The existing full/cockpit height policy remains unchanged.

Tests must measure the rendered text against button bounds under production CSS, preserve keyboard and selection behavior, and retain existing Today/Twin regression gates. A dedicated component fixture is not a live account or a physical iPhone acceptance test.

The separate angular selected-back contour issue is not fixed by this patch. Audit the registered GLB region primitives and shader attributes before changing the surface: masks, contour metadata and silhouette topology are distinct mechanisms. This patch does not replace geometry, add glow to hide it, change picking or repaint a personal Identity Shell. No physiological calculations, database data, providers or dependencies change.
