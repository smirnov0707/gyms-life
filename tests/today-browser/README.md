# Reference UI rendering fixture

This is an isolated visual harness, never a product route or a connection to a live account. The persistent **SYNTHETIC TEST FIXTURE — NOT USER DATA** label identifies every reference screenshot. Names, measurements, decisions and records are authored test inputs. They are not measurements of the current user and must not be presented as product results.

The full-shell mode mounts the real AppShell and the actual route components exported from app, twin, progress, lab and history. The sixth view opens the real Twin muscle detail interaction. It does not add a fake application route. Supported shell links navigate between these route fixtures; other links show an explicit fixture boundary, not a simulated successful operation. Server functions, auth and Supabase reads are replaced at the module boundary; no provider keys, user tokens or production data are used. Fixture inputs for Lab, Today decisions, daily briefs, forecasts and stored plans are validated against their current application schemas.

## Open for manual review

From the repository root:

```sh
node scripts/test-today-browser.mjs --serve-only
```

This mode starts Vite on `127.0.0.1:4183` and **does not launch Playwright**. Open it with the approved browser tool:

- `http://127.0.0.1:4183/index.html?shell=1&screen=today&scenario=reference`
- Change `screen` to `twin`, `muscle`, `futureme`, `lab` or `journal`.
- Change `scenario` to `empty` or `failure` to inspect missing evidence and source failures.
- Append `theme=light` to inspect the light theme. Language and theme controls work inside the real More drawer.

Synthetic reference presets select the existing representative programme, region, sleep-stage and evidence fixtures. Omitted values remain omitted. The fixture does not invent supported 180-day or one-year forecast outputs. For muscle detail, choose **Muscles → Chest**. The CI runner performs those same actual UI interactions.

The original standalone cases remain available, for example `?signals=fail`, `?panel=health`, `?panel=home&twin=regions`, and all prior regression assertions remain in the runner.

## CI screenshots and checks

The `Today browser` GitHub Actions workflow runs `node scripts/test-today-browser.mjs` with its own installed Chromium. Local work should use `--serve-only` plus the approved browser tool instead.

Before the existing regression assertions, CI captures the six views at **1440 × 1000 desktop** and **390 × 844 mobile**, then captures separate mobile empty and failed-read states. Screenshots use full-page capture, so a tall page may have a larger output image than its viewport. Assertions check the real navigation shell, source honesty, WebGL frame rendering for Twin views, horizontal overflow and uncaught page errors.

Download `today-browser-evidence` from the workflow run's Artifacts section. It contains:

- `reference-<screen>-desktop.png` and `reference-<screen>-mobile.png`;
- `reference-today-empty-mobile.png` and `reference-today-failure-mobile.png`;
- matching text snapshots and `reference-screens.json` with viewport/scenario metadata;
- all original Today evidence and `results.json` when the full suite completes.

Artifacts upload even on failure and are retained for 14 days. A CI screenshot proves a fixture render, not live account behavior, scientific validity or the Digital Human visual gate.
