# GYMS.LIFE Future Lab production release — 2026-09-10

## Canonical release

PR #61 promoted the verified Future Lab integration to `main` as merge commit `ab2179f50d93e9d0c20bb87cbceb70b1b0bf7b8d`.

The promoted lineage includes the reference Future Lab dashboard, Digital Twin and anatomy surfaces, Today/Lab/Journal/Morning Review UI, account-scoped offline workout state, application environment guards, atomic training/nutrition workflows, audited Night Lab receipts, and the first bounded per-athlete completion model lifecycle.

All nine exact-head workflow groups for source commit `1d0694f95d44e5678ad60b2a40c3d62a0e6c8dea` completed successfully before promotion.

## Production database boundary

Production was advanced only through the schema required by the promoted candidate, ending with `night_review_personal_backlog_guard`. Later staging-only engagement-policy/canary experiments were deliberately not promoted.

Pre-release data checks found zero cross-owner workout-session or set-log references. The production schema now has the atomic generated-meal-plan commit routine, restrictive workout/set parent-ownership policies, Night Lab review receipts, and personal-model tables/RPC guards. Personal-model mutation RPCs remain service-role only.

## Hosting verification

Netlify production deploy `6aa2ba62864db90009eaa426` successfully published `ab2179f50d93e9d0c20bb87cbceb70b1b0bf7b8d`. Public `/auth` assets were checked after publication: the production Supabase project reference was present and the staging reference was absent.

A production-only `GYMSLIFE_CRON_SECRET` was added after that deployment for the scheduled Night Lab dispatcher/worker handshake. Netlify requires a new deploy for environment-variable changes to reach functions; this documentation commit intentionally triggers that rebuild without altering application behavior.

## Remaining operational note

Supabase security advisor reports leaked-password protection disabled. The connected administration surface used for this release can audit that setting but cannot change the Auth configuration directly. The four RLS-with-no-policy notices are intentional deny-by-default service-only tables; newly added unused-index notices are informational immediately after creation and are not a reason to remove those indexes.
