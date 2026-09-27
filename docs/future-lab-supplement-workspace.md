# Supplement workspace

The supplement route completes the Nutrition / Plan / Supplements context navigation in the existing Future Lab visual system. It keeps the selected Twin and the four main product worlds intact.

## Interface

- Saved routine first: a daily timeline, an editable collection and a manual entry form. Active, paused and time-slot counts come only from a successful supplement read.
- Manrope / Space Grotesk, semantic dark/light surfaces, readable numeric time labels, 44px actions, visible keyboard focus and a single-column mobile layout match the adjacent workspaces.
- Existing deterministic scheduling rules, stored doses, notes and timing preferences remain. Example clock times are explicitly distinguished from reminders and recorded intake.
- An empty list and an all-paused routine have different states. Initial and subsequent read failures show an unavailable state with retry; no stale metrics or empty-list claim are shown. Manual edits stay disabled until the read succeeds.
- Keyboard submission and the hero shortcut focus the entry form. Failed writes retain drafts and saved rows, with generic errors instead of database details. Toggle/remove controls have item-specific accessible names.
- Label, food-log and cycle tools mount when requested. Folding them preserves editable drafts. Folding the camera tool releases its stream; a permission response arriving after closing/unmounting is stopped before attachment. Opening a tool never starts a camera. The permission guard also reads the native disclosure state because its toggle event can arrive after the surface has closed.
- Existing analytical service contracts and model routing are unchanged. Nutrient/cycle displays use theme-aware colors.

## Verification

`scripts/test-core-supplement-design.mjs` extends the established Chromium/WebKit core harness:

- Twelve full-page captures per engine: saved routine, empty list and editable label draft; 1440/390px; dark/light. The PNGs come directly from Playwright with bytes and SHA-256 metadata.
- Initial/pending/cached read errors and retry; manual keyboard add with absent dose preserved as null; reload, pause/resume, removal and all-paused state; failed writes; lazy tool activation and draft retention; keyboard-operated live and late-permission camera stream disposal, including no late attachment.
- 320px Lithuanian layouts, real navigation state, fonts, control size and horizontal overflow.

All test writes remain in synthetic in-memory fixture state. Synthetic labels and simulated streams do not certify real product recognition, medical advice, hardware-camera compatibility or production account transactions. The selected Twin GLB and material are untouched. Keep PR #87 draft for visual acceptance; no main merge or production release.
