# Future Lab context workspaces

Training, Nutrition, Meal Plan and Profile extend the shared visual system. They
remain contextual tools under Today / My Twin / Lab / Coach, rather than new
navigation worlds.

`src/context-workspaces.css` provides theme-aware hero surfaces, display numerals,
context cards and responsive grids. Typography and colors come from the existing
Manrope / Space Grotesk theme. The selected Twin asset and shader are unchanged.

- Training keeps its saved programme, regeneration/removal actions and native
  strategy disclosure. Known goal codes display their localized labels; free-form
  goals remain verbatim. Exercise names can wrap rather than being truncated.
- Nutrition has one main heading, a four-card intake view (two columns on mobile),
  and adjacent meal-entry/hydration tools on desktop. The food field has a visible
  accessible label. Unknown totals remain unknown and source notes remain visible.
- Meal Plan uses the same navigation and context header. Saved preferences, plan
  generation, allergy disclosures, adaptation and export behavior are preserved.
- Profile places stable body facts beside memory controls on desktop and stacks
  them on mobile. Shorter English/Lithuanian copy explains the data without
  implementation terminology. Evidence and memory controls remain available.

## Reproducible review

Run `npm run test:browser:core` for existing workflow gates plus the contextual
visual audit. Use `CORE_BROWSER_ENGINE=webkit` for the second browser engine.
`scripts/test-core-design.mjs` checks 16 desktop/mobile dark/light captures, loaded
local fonts, rendered heading/metric text colors against both hero gradient
endpoints, 320px Lithuanian overflow, primary mobile action placement and keyboard
strategy disclosure. Contrast checks are representative, not WCAG certification.

The core fixture can render the actual application shell with `shell=1`. Profile
responses and writes remain synthetic; server-side validation and real account
transactions are outside this presentation fixture. `--serve-only` starts a local
preview; `--design-only` runs only the visual checks. `CORE_BROWSER_PORT` defaults
to 4184; `CORE_BROWSER_ARTIFACTS` can separate local browser-engine evidence.

Review the unedited captures and hashes in `context-design-review.json` before
merging. Keep PR 87 draft until the visual direction is accepted. No production
deployment or Twin replacement is part of this change.
