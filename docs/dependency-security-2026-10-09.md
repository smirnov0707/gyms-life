# Scoped dependency security remediation — 2026-10-09

Base: c504eb10dd1db804c6642fd8d9f796b834d4098d. Runtime source, Twin geometry/controls, providers and user data are unchanged.

## Patches

- sharp 0.35.4 → 0.35.5, including bundled librsvg 2.63.2. Maintainer advisory: https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w
- smol-toml → 1.9.0. Maintainer advisory: https://github.com/squirrelchat/smol-toml/security/advisories/GHSA-r4xh-jqrq-34v2

Only exact resolution pins and their lock entries change. No broad npm update, force audit fix, major downgrade, renamed vulnerability, disabled audit or exception allowlist. The existing security floors are raised, never lowered.

## Recorded npm registry audits

Full dependency tree: 18 before → 12 after. Production-only tree: 0 findings. Counts are package-level advisory propagation, not independent exploits.
A development-only classification does not prove zero deployment exposure; build tools execute during packaging. A clean npm report is not a comprehensive security assessment.

## Unresolved upstream advisories

- braces: braces vulnerable to stack-exhaustion denial of service through deeply nested patterns. https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- node-forge: node-forge RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements. https://github.com/advisories/GHSA-86w9-cpqp-85rv

The unresolved findings are retained in full audit evidence. braces and node-forge advisories have no published patch as reviewed on 2026-10-09. Do not accept untrusted glob/TOML/config input in development servers or packaging workflows. This patch does not claim to remediate them.

## Acceptance

Required: TypeScript, complete unit/contract suite, unchanged lint, both builds, actual consumer-resolved AVIF/SVG operations, Netlify configuration parsing and synthetic function packaging, Wrangler dry-run and TOML parsing, existing Twin navigation and actual muscle-picking regressions. No live account, production deploy or physical-iPhone test is implied.

The candidate is not a production release; all normal final-head PR checks must also pass.

The first run detected an outdated exact libheif assertion (1.23.2); Sharp 0.35.5 actually resolves libheif 1.23.5. The assertion now requires that newer verified binary plus librsvg 2.63.2. No version check was deleted. A separate real Wrangler TOML dry-run verifies compatibility with smol-toml 1.9.0 null-prototype objects, in addition to the existing JSON dry-run. Both use isolated synthetic configs and never deploy.
