# Future Lab account entry

The sign-in, account creation and password recovery routes share `AuthFrame`, with the application brand, local Manrope/Space Grotesk fonts, light/dark surfaces, language/theme controls, an editorial introduction on desktop and a compact mobile introduction. The four product worlds are described without fabricated body measurements or a replacement Twin.

`Brand` contains the existing logo and language switch, with their base CSS owned by the same shared component; AppShell re-exports them for existing callers. Account entry imports these pure components directly. Styles are scoped to `.fl-auth` and its descendants. Auth browser fixtures render the actual brand and ThemeProvider.

Password fields retain labels, autocomplete and length constraints and add a named, keyboard-operable visibility toggle. Form errors persist inline, confirmation remains distinct from a signed-in session, and password recovery receipt does not assert that an account exists or that mail was delivered. A new recovery attempt clears the previous receipt. Signup copy no longer promises a plan within sixty seconds.

Existing Supabase service contracts, redirect validation, session readiness, request locks and authenticated password-update gates remain. No schema, provider, billing or Twin changes. Email delivery semantics follow [Supabase password authentication guidance](https://supabase.com/docs/guides/auth/passwords).

## Validation scope

`test:browser:auth` runs the real routes and AuthProvider with synthetic Supabase responses in Chromium and WebKit. It covers duplicate submission, signup with/without a session, safe redirects, missing recovery sessions, mismatch, confirmed updates, failed sign-in/OAuth/recovery/update, keyboard visibility, theme/language persistence and narrow layouts. No real account is created, no email is sent and no OAuth provider is contacted.

The review captures sign-in, signup, confirmation, recovery request, request receipt, password update and expired/missing-link states at 1440px and 390px in both themes: 28 PNGs per engine. Chromium emits hashed, unedited captures for review. Capture checks also pin the brand mark to 36px and keep mobile Sign in inside the first 844px viewport. Finite transitions are completed before capture. Additional Lithuanian checks run at 320px, including 44px preference and visibility controls. These are representative visual/accessibility checks, not a full WCAG certification or a live authentication delivery test.

Keep PR #87 draft for visual acceptance. Do not merge main or deploy production from this iteration. Overall 1:1 reference acceptance and v9 Digital Human authoring remain separate gates.
