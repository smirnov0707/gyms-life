# Twin mobile cockpit

Presentation follow-up to the continuous 360-degree surface (baseline `fd617925`).
No geometry, camera math, physiological model, AI contract or Supabase schema changes.

## What changes

- The existing Twin page no longer adds its own second layer of mobile page padding
  inside AppShell. The existing application shell and navigation are unchanged.
- A small-viewport-sized body stage replaces the long stack of camera controls,
  introductory text, technical metadata and a large recovery card.
- Drag/pinch remain primary. An always available, labelled region selector and a
  44px view-controls button provide alternatives. Camera presets, rotation/zoom
  buttons, keyboard help and motion toggle are disclosed, not removed.
- Escape from expanded view controls closes them and returns focus to their trigger.
- The selected region's name, category and explicitly labelled recovery estimate
  remain visible in a compact lower inspector. Evidence, logged volume and last
  trained time expand on request. Unknown data is still explicit.
- Model version, data window, timestamp, evidence coverage and the colour legend
  are available to mobile and desktop users through Model & evidence.
- The independent pulsing rings have been removed from this surface: the existing
  motion toggle now controls the only animated presence (the model), and reduced
  motion still permits user-controlled 360-degree inspection.
- Changing user identity remounts the presentation to clear selection/disclosure
  state; the existing user-scoped query and server authorization remain intact.

## Validation

Use the repository's typecheck, test, lint and production build gates. Run
`node scripts/test-twin-browser.mjs` for browser regression tests. An optional
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` supports explicitly installed Chromium
binaries; CI uses its pinned Playwright browser by default.

The fixture renders the actual TwinSnapshotView with labelled synthetic data and
no backend access. Additional checks cover evidence disclosure, Escape focus,
touch target sizes, selected-region visibility with a reserved mobile dock area,
Lithuanian text at 320px and 200% text size. The previous rotation, raycasting,
pinch, fallback, context-loss, unmount and reduced-motion checks remain.

This fixture does not exercise the authenticated production shell or replace
physical iPhone/Android interaction and battery testing. Small/landscape screens,
enlarged text and expanded inspectors may scroll vertically by design; content
must not be clipped or forced to fit at the expense of accessibility.

## Next

Add a second real layer (for example recorded training volume) only with explicit
units, legend and evidence semantics shared by the scene and inspector. Do not
rename weight-times-repetitions as measured muscle activation or future growth.
