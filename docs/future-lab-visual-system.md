# Future Lab visual system

The application uses one semantic palette, including authentication, contextual
tools, settings, shared controls and portalled dialogs. The product worlds remain
Today, My Twin, Lab and Coach; Future and Timeline are views within My Twin.

## Typography

- Manrope: interface copy and controls, 400–700.
- Space Grotesk: brand, display titles and key measurements, 500–600.
- Tabular numerals: comparable measurements and counters.

Both full variable fonts ship in `public/fonts` with their OFL licenses and source
blob identifiers. The root preloads them. The browser fixtures use the same CSS
and assets; a missing font fails the visual review instead of silently producing
fallback-font screenshots. Extended Latin glyphs are retained.

## Color and materials

`src/styles.css` owns the semantic tokens. Dark mode uses midnight ink, mineral
blue surfaces and iris accents; light mode uses pale paper, white surfaces and a
deeper iris. Positive, caution and unavailable states keep their meaning. The
action gradient has separate dark/light endpoints and foreground colors.

`src/ui-design-system.css` owns shared controls. `future-lab-shell.css` owns shell
layout and interaction primitives; `future-lab-visual-system.css` composes their
visual treatment across the application. Component sheets own their dimensions.
Use tokens rather than new per-route palettes. The Twin is an intentional dark
media stage; CSS framing must never replace its reviewed geometry or shader.

## Interaction and verification

The mobile dock has four worlds and accommodates safe-area insets. Keyboard users
can skip to the main content. Focus rings are visible. Form fields retain mobile
zoom protection without enlarging every button. Reduced-motion preferences apply
to CSS transitions and animations throughout the application.

`scripts/test-visual-system.mjs` checks the two local fonts, theme token text
contrast (at least 4.5:1), skip-link focus, Coach input state, reduced motion and
overflow. These are representative checks, not a claim of whole-app WCAG
certification. `test-today-browser.mjs` also captures all seven world/detail views
at desktop and mobile sizes and retains the existing functional and layout gates.
Light-theme views and the action drawer are captured separately.

Review the unedited screenshots before merging. Test data must stay visibly
labelled synthetic. No production release or model change is implied by a design
system update.
