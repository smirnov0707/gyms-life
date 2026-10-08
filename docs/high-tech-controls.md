# Shared high-tech control surface

This increment builds on released main `8fb81858e6842a3f67af22aa860395058a6d8a59`. It does not replace the released command drawer, the four product worlds, or the natural-skin Twin.

## Shipped source scope

Button, Input and Textarea retain their public props, refs, variants and Slot composition. Shared scoped styles give them consistent focus outlines, readable theme-token text, tabular input numbers and restrained press feedback. Default buttons and inputs have a 44px minimum height; large buttons have 48px. Compact desktop buttons retain a 36px minimum, enlarged to 44px for coarse pointers. Labels wrap instead of being forced onto one clipped line. Reduced motion disables the shared transitions and press displacement. Forced-colors uses the native Highlight focus color. Invalid fields still depend on explicit aria-invalid and their existing validation messages; no validation behavior changes.

The Calendar is an explicit compact-grid exception: date targets, navigation arrows and caption follow its existing `--cell-size` (32px by default). Shared action minima must not enlarge its arrows or override its minimum column width. The real integration initially reproduced a 6px caption/navigation misalignment and 22px desktop dates. Scoped Calendar minima address that without reducing other action controls. Tests measure the rendered geometry against the configured viewport, not just an expanded mobile layout viewport.

Port the remaining run-continuity safeguards from PR #146: reconcile refused local writes/removals before clearing the storage warning, assert theme-correct run headings, and exercise retention recovery before reload. Keep the existing saved-run recheck service and no-duplicate-credit boundary.

This is a shared control-layer change, not a claim that every page layout has been redesigned. Bespoke controls not using these primitives need separate review. No schema, RLS, production data, personal textures, AI workers or dependencies change.

## Verification boundary

The isolated control fixture imports the real production primitives and stylesheet. It contains no account, backend or network mutations. The browser matrix checks both engines, dark/light themes, reduced motion, narrow/desktop layouts, wrapping, focus, disabled state, native form behavior and Slot links. The Calendar matrix additionally verifies date selection, disabled-date keyboard navigation, month navigation and no accidental form submission. Existing Core, Today, Twin, Body replay, Auth and command-center suites remain required before release. Shared UI changes now trigger Twin and Body replay checks, guarded by a workflow-coverage test. Browser fixtures are not physical-iPhone or live-account acceptance. Results must be reported from executed checks, not this document.
