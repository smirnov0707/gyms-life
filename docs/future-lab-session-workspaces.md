# Session and recovery workspaces

Workout execution and Daily readiness use the established Future Lab display/body fonts, semantic surfaces and theme-aware controls. This continues the four-world system: Today, My Twin, Lab and Coach. Progress remains inside My Twin.

- The workout logger puts repetitions, optional load/RPE and the primary log action before the optional voice draft in both DOM and visual order. The progress bar has a named numeric value, RPE has an associated label, and the nested main landmark is removed. Session start, resume, offline queue, extra sets, completion and reflection retain their existing implementation.
- Recovery uses a two-column desktop evidence/form layout and compact mobile input cards. Slider thumbs carry their visible accessible names and keyboard values. Unsaved defaults are explicitly labelled as a draft. Saved data, loading, a failed read and an empty day have distinct presentations; missing scores/load remain unknown. Retry uses the existing owner/day-filtered query. Calculations use the same production readiness engine; backend persistence and schema are unchanged.
- The selected Twin asset, material, region ownership and masks are unchanged. This work does not certify the historical v9 authoring or the overall visual acceptance gate.

## Verification

`scripts/test-core-session-design.mjs` runs through the real route components and AppShell using synthetic account/service boundaries. It adds 20 dark/light desktop/mobile captures, tests loading/failure/retry, missing values, keyboard slider save/reload, failed writes and 320px Lithuanian layouts. Existing core workflow tests continue to cover workout execution, resume and offline handling. Screenshots are explicitly synthetic and do not certify live account writes.

When `CORE_BROWSER_REVIEW_EMIT=1`, CI emits hashed PNG chunks from these synthetic captures for visual inspection in an environment that cannot bind a local preview server. The normal artifact upload retains the same files. No screenshots of live accounts are emitted.

The Supabase query contract remains zero-or-one row with errors handled separately: [official maybeSingle documentation](https://supabase.com/docs/reference/javascript/using-modifiers-maybesingle). No database API, RLS, authentication or migration changes are introduced.

Keep PR #87 draft until visual acceptance. No merge to main or production deployment is part of this iteration.
