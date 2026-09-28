# Production release marker — 2026-09-28

## Why this file exists

`netlify.toml` runs `scripts/netlify-ignore-build.mjs` as its build `ignore`
command, and that script allows a production Git deploy only when the commit
message contains `[release production]`. The gate is deliberate — it keeps paid
production builds from firing on every merge — but it is also silent: a merge
without the marker is skipped with no failure anywhere to notice.

That is what happened to the Future Lab visual system. `93324d6`
(`[release production] Restore verified production context after preview
publish`) built and published. `cdcfc27` (`release: Future Lab unified visual
system`) merged `222b9f4` into `main` afterwards **without** the marker, so it
never built. Production has been serving `93324d6` since, and none of the work
below has been live:

- `0c85711` Unify Twin history and withdraw failed snapshot reads
- `6852eed` Keep the synthetic camera boundary stable across native reopen tests
- `f15afc5` Clarify muscle comparisons and interval evidence in Future Lab
- `222b9f4` Scope back-view assertion to comparison controls

This documentation-only commit carries the marker so `cdcfc27`'s tree reaches
the primary domain. No application code changes.

## Verified before publishing

Run against `cdcfc27fa7076c874a4e7d02185dd65ccd3dee15`, clean worktree:

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | 2039 passed, 247 files |
| `npm run lint` | 0 errors, 26 accepted `react-refresh` warnings |
| `npm run build` | passes |
| `npm run test:netlify-release-gate` | passes |
| `node scripts/verify-release-dependencies.mjs` | release runtime dependencies are local |

Production was confirmed behind by asset identity rather than by assumption:
the live document referenced `assets/styles-DZuZmLN7.css` while this tree builds
`assets/styles-DjSW2Dnm.css`.

## What to check once the build publishes

`npm run smoke:production` is the authoritative check, and the `Production
smoke` workflow runs it on every push to `main` and hourly. The asset identity
above is the quickest manual confirmation that the new tree is the one being
served.

## If a release is skipped again

The marker is the only thing standing between a merged change and a live one.
A merge to `main` that is meant to ship must carry `[release production]` in its
own commit message, or be followed by a marker commit like this one.
