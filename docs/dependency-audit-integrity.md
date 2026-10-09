# Dependency audit integrity

Base: released `a6eef9e170855603a873e2392adc9f6e05769713`.

## Defect

The full-tree `npm audit` step used `continue-on-error: true`. This treated an expected vulnerability exit and an unavailable registry, malformed response, process timeout or other tool failure alike. An unsuccessful read is not a clean or completed audit.

## Guard

`scripts/dependency-audits.mjs` runs production and full-tree audits separately, always attempting both even when production has findings or its process fails. It retains the original JSON plus a trusted `audit-status.json`, invalidating previous status before execution. Each subprocess has a 90-second limit and a 16 MiB output bound; an exceeded bound fails, not truncates to a successful report. No dependency is installed, changed, renamed or patched by the script.

The supported npm v2 report is validated: schema version, absence of registry errors, severity/dependency counts, package entries, count consistency and exit status for the unchanged moderate threshold. Missing, unsupported or contradictory evidence is `unavailable`, never zero. New incompatible npm report formats require review rather than a silent fallback. The full-tree command explicitly includes development, optional and peer packages, even when environment defaults omit development packages.

Production moderate/high/critical findings still block. Existing full-tree findings remain visible as a warning and retained raw report; they do not become an allowlist or a claim that the packages cannot reach production. An unavailable audit in either scope now blocks the security job. Quality remains a separate job and cannot be skipped because of a security finding. Advisory titles and registry error text are never interpolated into workflow commands or the trusted step summary.

## Verification

Run `node --test scripts/dependency-audits.selftest.mjs` without installing anything or contacting a registry. It covers valid severities, propagated package findings, malformed/missing/contradictory data, timeouts, killed/failed processes, both-scope execution, retained evidence, stale-success invalidation, workflow-command text and actual CLI exit behavior with an isolated fake npm executable. Real registry acceptance is the separate CI security job, not these synthetic tests.

For the real audit, run `node scripts/dependency-audits.mjs` after `npm ci`. Evidence stays under `test-results/dependency-security` with the original artifact name and raw report filenames. GitHub Actions runs the self-tests and the real audits; no scheduled background task or deployment is introduced.

## Limits

This change prevents false audit-completion claims. It does NOT patch braces/node-forge or remediate their vulnerabilities; issue #152 stays open. A zero production-only registry count is not a complete runtime, build-service or deployment-bundle security assessment. The existing larger Twin, gestures, shaders, selection, user context, auth, database and provider code are untouched. No production release is required for this CI-only change.

References: npm audit command/exit threshold documentation, https://docs.npmjs.com/cli/v11/commands/npm-audit/ ; unresolved advisories https://github.com/advisories/GHSA-vfj7-8cjw-p6xm and https://github.com/advisories/GHSA-86w9-cpqp-85rv (reviewed 9 October 2026).
