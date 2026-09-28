# Movement workspace

The `/ar` context tool follows the Future Lab visual system: Manrope/Space Grotesk, theme-aware surfaces, three named analysis modes, a deliberate dark camera stage, readable empty evidence, and accessible controls. Desktop pairs the preview with evidence; mobile stacks the panels. Settings remain inside the camera panel so they are reachable in fullscreen. Escape releases the scroll lock.

Live coaching stays on-device. Technique review retains its explicit five-frame upload action; position review uploads the chosen image. Mode-specific copy explains those different actions before capture. No live camera starts on route entry or mode selection. No Twin mesh, material, muscle masks, region ownership, rep algorithm, AI routing, auth or schema changes are included.

## Resource ownership

`useCameraStream` owns tracks independently of the video ref and invalidates pending requests on stop/unmount. A stale permission reply disposes its stream without attachment. Playback errors dispose the acquired stream. Live mode additionally owns its detector, animation loop and pending voice cue. Cancelling startup, changing modes, finishing, switching-camera failure and unmount all release that session. An asynchronously created detector is closed if its startup request is no longer current.

Technique review uses the same stream owner. Leaving its screen invalidates the frame-collection loop before it can submit a new analysis request. It also ignores replies from an already-submitted request after leaving; this does not claim to cancel server work already sent.

## Validation boundary

Core browser checks run the production route/components with synthetic account queries and controlled media/model adapters in Chromium and WebKit. They cover four states in two themes at 1440/390px, keyboard mode/setting actions, missing height, fullscreen escape, cancellation, playback/switch failure, active and late-stream disposal and Lithuanian 320px layouts. Review PNGs are unedited and hashed.

The adapter emits no anatomical pose and never accesses a hardware camera or external model. These checks validate lifecycle and rendering, not model accuracy, actual camera playback, biomechanics, medical conclusions or live account writes. Existing rep/calibration tests remain the algorithm checks. Keep PR #87 draft pending visual acceptance.
