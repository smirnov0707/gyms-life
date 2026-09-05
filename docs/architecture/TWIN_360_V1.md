# Future Lab Phase 3A — Twin 360 V1

## Scope and current-state baseline

This evolves the existing `TwinView`, `TwinSnapshot`, `BodyMap` and the in-progress
Living Twin visual-state work. The audited main baseline was `1097130`; the
unmerged Living Twin foundation was `6e05d80`. The renderer does not require a
Supabase migration or a second source of truth.

The existing catalogue groups are coarse. V1 places chest, back, shoulders,
arms, legs, glutes, core and abs on a generic 3D body. Fullbody, cardio, mobility
and unrecognised groups remain available in the existing All Regions inspector,
not distributed onto muscles without evidence. Both arms and both legs share
their respective group value: there is no left/right diagnostic inference.

## Architecture

Authenticated canonical state -> TwinSnapshot -> canonical visual mapper ->
`mapTwinScene` -> `TwinStage` -> lazy `twin-scene.runtime` -> Three.js.

`TwinView` retains its existing region inspector and data service. The 2D and 3D
surfaces select the same region identity. They never persist new health facts.
Only recovery is currently rendered as an intelligence layer. There is no dead
Future/Stimulus toggle and no invented simulation.

Three.js and its official OrbitControls are sufficient for V1. React Three Fiber
and Drei are not required for this small imperative rendering island; avoiding
additional renderer/helper dependencies keeps the change smaller. Three.js and
its type definitions are pinned to 0.180.0. The runtime is dynamically imported
from an effect, never mounted during server rendering.

## Visual truth

The mesh is locally authored procedural geometry, not downloaded licensed art,
a personalised scan, an estimate of body fat or a guaranteed future appearance.
Geometry is deliberately schematic. Neutral surfaces do not carry health claims.
Missing or invalid region evidence remains unknown. Colour is determined by the
canonical recovery band. The pre-existing visual mapper's independent 45/75
thresholds have been removed; it now uses the canonical bands instead.

Selection highlighting is a UI treatment, not increased activation or recovery.
Subtle model sway is decorative, not heart rate or breathing telemetry. This is
stated next to the controls. There are no biometrics, predictions or physiology
calculations in the rendering runtime.

## Interaction

- One finger / left-button drag: continuous horizontal 360-degree orbit.
- Vertical orbit is bounded to keep inspection upright.
- Two-finger pinch or wheel: bounded zoom; no panning.
- Front, back and side presets; reset and zoom buttons.
- Keyboard left/right, plus/minus and Home on the focused canvas.
- Mesh picking uses the nearest body surface, including neutral geometry, so
  clicks cannot pass through the torso to select an occluded region.
- A six-pixel gesture threshold and multi-pointer tracking separate taps from
  drags and pinches. The accessible region selector does not require 3D picking.

## Resilience and performance

A 2D/3D switch always remains available. During lazy loading, the existing 2D map
is retained. An import timeout, WebGL initialisation error, render exception or
context loss falls back to 2D. Context loss also disposes GPU resources; retry
creates a new renderer rather than trying to reuse invalid state.

The runtime disposes geometry, materials, controls, observers, event listeners,
requestAnimationFrame work and the WebGL context on unmount. Device pixel ratio
is capped at 1.5. No external textures, HDR environments or heavy post-processing
are required. Decorative rendering is capped at 30 fps and pauses when hidden or
outside the viewport. With reduced motion or motion disabled, rendering is
on-demand (including a short damping tail when reduced motion is not enabled).
Reduced motion preserves user-controlled 360-degree inspection.

## Quality gates

Run the existing repository gates:

```
npm ci
npm run typecheck
npm run test
npm run lint
npm run build
```

Run browser regressions:

```
npx playwright install --with-deps chromium
node scripts/test-twin-browser.mjs
```

The browser fixture renders the real `TwinSnapshotView` using explicitly
synthetic test data. Only its backend service is stubbed. It is not an application
route, does not bypass production authentication and does not access user data.
The browser test checks orbit, mesh selection, drag suppression, zoom, keyboard
control, unknown states, context loss/retry, 2D fallback, StrictMode lifecycle,
mobile pinch, a 320px layout and reduced-motion idle rendering. Screenshot and
JSON artifacts are produced by the read-only Twin browser workflow.

A green Chromium/emulated-mobile test is not proof of real iPhone GPU/battery
performance. Physical iPhone Safari and Android verification remains a separate
release check, as does an authenticated production smoke test.

## Rollback and next phase

The renderer is isolated. A presentation rollback can select the existing 2D
map without touching user data, Supabase schema or intelligence services.
Phase 3B should add another layer only when it has a distinct canonical source,
then share its legend, units and inspector across both renderers. A licensed or
locally authored higher-fidelity mesh can replace the schematic geometry using
the same group identity mapping; it must not imply more precise evidence.
