# Goal intake and movement library

Goal intake, the exercise catalogue and movement detail continue the established Future Lab visual system: self-hosted Manrope/Space Grotesk, semantic dark/light surfaces, violet actions and cyan supporting accents. The selected Twin geometry, material, masks and ownership are unchanged.

The intake uses a compact goal header, readable selection cards, named step progress and a consistent generated-plan review. Quick and full modes retain the same validated input schema, saved profile preferences, generation lock and activation behavior. Decimal body inputs use the appropriate mobile keyboard. The countdown and decorative day-progress bars are removed; neither represented actual progress. Blank measurements remain unknown.

The catalogue puts search and movement cards ahead of the optional Coach builder. Filters have pressed states, localized names and touch targets. Read failures show a retry state independently of loading, a successful zero-result search and the result count. Favourite storage is validated before rendering. Pagination, exercise data and AI routing are retained.

Movement detail separates the demonstration, source instructions, known exercise anatomy and common mistakes. Existing media is contained rather than cropped. Demonstrations now use native video controls or labelled frame controls and start still by default. Reduced-motion preferences suppress opt-in autoplay. The previous invented angle/phase labels and AI-optimized badge are removed. Anatomical descriptions use the existing slug-specific data where available, preserving the generic scope disclaimer otherwise; no anatomy mapping is authored here.

## Review evidence

`scripts/test-core-intake-design.mjs` extends the existing real-route browser suite with 20 dark/light desktop/mobile screenshots: intake goal, body, generated result, catalogue and movement detail. It checks source media loading, font selection, touch target height, horizontal overflow, keyboard frame control/focus restoration, query failure/retry, filters, favourite persistence, navigation, the full intake and unknown body values. Narrow 320px Lithuanian layouts are also checked.

The core fixture wraps public exercise routes in their own production AppShell without nesting main landmarks. Account/service boundaries and catalogue descriptions are explicitly synthetic; source media is the existing local catalogue media. Screenshots may be emitted in hashed chunks through the existing opt-in CI review flag. This does not certify real account transactions or every catalogue movement.

Keep PR #87 draft for visual acceptance. No merge to main, production deployment or new v9 authoring build is included.
