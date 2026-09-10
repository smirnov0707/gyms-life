# Dependency security remediation — 2026-09-09

Base: `4ef868065a310b3cd1ab4f5039e047736aee4076`, PR #55, `codex/future-lab-reference-ui`.

## Observed baseline, not the previous report

A fresh npm audit on the unchanged lockfile reported **13 high-severity affected package entries**, not the previously recorded 12 (9 high, 3 moderate). This is a count of affected packages, including transitive parents, not 13 independent vulnerabilities. Advisory data changed; the application lockfile had not.

The separate `npm audit --omit=dev` baseline reported zero findings. Every affected lockfile entry was development-only. That limits what this finding says about runtime exposure; it does not make vulnerable build and local-development tools harmless, and it is not proof of deployed application security.

## Changes

| Dependency chain           | Before                                                  | Remediation                                                                                                                              |
| -------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Netlify local runtime      | `@netlify/dev` 5.0.2, `functions-dev` 2.0.2             | Resolve within the existing permitted range to 5.0.5 and 2.0.5; the upstream implementation no longer depends on unpatched `extract-zip` |
| Netlify function packaging | `zip-it-and-ship-it` 15.4.0, `toml` 3.0.0               | Upstream 15.5.1 selects supported TOML 4.3.0, above the 4.2.0 patch floor                                                                |
| Native image processing    | Sharp 0.34.5 and nested 0.35.2                          | One explicit `sharp: 0.35.4` override, including IPX and Miniflare; bundled libheif 1.23.2                                               |
| Unused adapter             | Nitro `3.0.260603-beta` and its private dependency tree | Remove the unused direct development dependency; no application source or active build configuration imports it                          |

Netlify remains the production build adapter. Cloudflare staging still uses TanStack Start's existing Workers output directly; `vite.config.ts` and `STAGING.md` already describe this. Wrangler stays at 4.129.0. The audit's suggested downgrade to 4.15.2 was not applied. All retained direct dependency versions, including TanStack, React, Vite, Wrangler and Three.js, remain unchanged.

The nested vulnerable Undici 7.28.0 disappears with the unused Nitro tree. The retained production Undici is still 7.29.0. No forced broad update, audit exclusion, or advisory suppression is used.

## Compatibility and reproducibility

The original iMac `node_modules` was a symlink shared with `main-current`. Resolution and a fresh `npm ci` were performed in the sibling `work/continuation-20260909-security/dependencies` directory. Only this worktree's symlink was redirected to that installation; the original shared directory and its dependency files were not edited. The previous link is recorded in `original-node-modules-link.txt` and retained as `original-node-modules` beside the evidence.

Scoped parent overrides initially left Miniflare's pre-release dependency holding Sharp 0.35.2. That attempt remained an audit failure. The final single Sharp override resolves all three consumers—IPX, Miniflare, and ndarray-pixels—to 0.35.4. The override is not accepted on version strings alone: synthetic AVIF-to-PNG tests execute each consumer's actual resolved native module, and the existing IPX 3 API is exercised through a real resize/WebP conversion.

`npm run test:toolchain` additionally parses the actual Netlify build configuration through its resolved TOML dependency, packages a synthetic Netlify function, and compiles a synthetic Worker with Wrangler's `--dry-run` flag. The Worker test uses a temporary working directory and isolated HOME with no inherited deployment credentials. These tests never deploy or read athlete records.

Eight lockfile regression tests fail against the baseline and pass after remediation. They check every matching nested dependency, the removed archive implementation/unused adapter, the reviewed patch floors, and manifest/lockfile synchronization. Static floors cannot detect newly disclosed issues, so CI also runs a live audit.

## CI acceptance

The existing quality workflow now audits the full dependency tree and production dependencies separately, fails at moderate or higher severity, and retains JSON audit artifacts even when an audit fails. It also runs the real toolchain smoke suite and both staging and production builds without deployment. Existing application tests and browser workflows remain required; their assertions are not weakened.

A clean audit means **no currently reported npm advisories for that resolved tree**, not that the application has no security flaws. The production environment receives no remediation until an approved deployment. This PR remains a draft with visual 1:1 approval outstanding.

## Primary references

- Netlify functions-dev source and version history: https://github.com/netlify/primitives/tree/main/packages/functions-dev
- Netlify packaging source and version history: https://github.com/netlify/build/tree/main/packages/zip-it-and-ship-it
- Unpatched archive traversal advisory: https://github.com/advisories/GHSA-jmr9-qjv8-65gv
- TOML recursion fix: https://github.com/BinaryMuse/toml-node/security/advisories/GHSA-82x6-q7mm-w9cf
- Sharp/libheif advisory: https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c
- Sharp release: https://github.com/lovell/sharp/releases/tag/v0.35.4
- Undici cache parser fixes: https://github.com/nodejs/undici/security/advisories/GHSA-4cwx-7wf7-3272

## CI-version lockfile reconciliation

The first npm 11-generated lockfile passed the local fresh install and audits, but CI's npm 10.9.8 rejected it before tests: the optional IPX/Unstorage Blobs peer subtree was absent. The initial install-root `npm ls` diagnostic correctly identified that unresolved optional range. This failure was not waived.

The lockfile was reconciled using an isolated npm 10.9.8 toolchain matching CI. Its resolver adds a scoped Blobs 10.7.13 subtree for Unstorage while Netlify keeps its required Blobs 11.0.3. Existing resolved package versions are unchanged by this follow-up; it adds the 18 required nested lockfile entries rather than downgrading Netlify or suppressing peer checks. A fresh npm 10 `ci` and `npm ls --all` from the real installation directory both pass. No global npm configuration or original shared installation was changed.

The follow-up uses `--ignore-scripts` for the isolated local installation; the actual native/build APIs are then tested, and unmodified CI `npm ci` remains the clean-install acceptance gate. The full audit still reports zero advisories after adding the optional subtree. Both initial failures and final results are retained in the evidence directory.

Local verification of the security changes: 1,118 tests across 146 files, 7 real toolchain smoke tests, TypeScript, staging build, production build, and 20 native-candidate Twin browser checks passed. Lint has zero errors and 27 pre-existing warnings. Final GitHub results must be recorded for the delivered commit separately.
