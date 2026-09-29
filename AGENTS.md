# GYMS.LIFE engineering rules

- GYMS.LIFE is the central orchestrator and source of truth for user context.
- AI providers are replaceable specialists; never store user truth inside a provider.
- Keep secrets server-side. Never prefix provider secrets with `VITE_`.
- Supabase RLS is mandatory for user-owned data.
- Do not introduce vendor-specific AI gateway dependencies into business logic.
- Prefer deterministic trend detection and auditable insights before asking an LLM to interpret them.
- Test `npm run build` and `npm run lint` before production deployment.

## Rules earned from bugs

Each of these was a real defect that reached production, and each recurred
because the fix was applied to one call site instead of the pattern.

- A read that failed is not a read that found nothing. Check `.error` on every
  Supabase query: `null` rendered as "you have no programme" to an athlete who
  had one, and as "no subscription" to someone paying.
- A missing measurement is null, never a plausible constant. `?? 75` kg,
  `?? 178` cm and `age = 30` all put an invented body behind a number the
  athlete reads as their own — and behind the confidence score beside it.
- A calendar day belongs to the athlete's timezone, not to UTC. Use
  `athleteDay()` for any `*_on` column: the UTC slice is yesterday for
  everyone east of Greenwich in their small hours, and `body_metrics` upserts
  on `(user_id, measured_on)`, so it overwrites instead of recording.
- Page surfaces read from the theme tokens (`bg-surface`, `text-foreground`,
  `border-border`). Literal darks belong only inside a deliberate dark stage —
  a camera feed, a media player, the Twin's canvas — and an accent that only
  reads on onyx needs a `light:` shade beside it.
- Component copy falls back through `baseLang`, not `lang === "en"`. Six of the
  eight shipped locales have no copy branch of their own, and the wrong test
  handed all six Lithuanian.
- Fail-open is not fail-silent. A path that must never break the athlete still
  has to write down that it broke: `personal_timeline_events` failed 233
  consecutive times and was only ever found because it recorded them, while the
  Night Lab recorded nothing and three weeks of not running looked exactly like
  an athlete who had not trained. Swallow the error, keep the reason —
  `captureShadowPredictionQuietly` and `runNightLabDispatch` are the shape.
- An upsert's conflict target and its index are one decision, and no file holds
  both. `personal_timeline_events` had a correct four-column `onConflict` and a
  correct four-column index that happened to be partial; PostgREST emits a bare
  `on conflict (cols)`, Postgres answered 42P10 every time, and neither file was
  wrong on its own. `upsert-conflict-target.test.ts` reads the pair.
- A count is not variation. Thresholds that wait for "enough" evidence are
  satisfied by one observation repeated: 42 shadow forecasts of `probability: 0`
  against 41 outcomes of `false` scored a calibration gap of 0 and a Brier score
  of 0.000 — the best values either can take — for a model that had never made a
  distinction. Before scoring anything, ask whether the inputs varied.
- A camera or microphone opened across an `await` must be claimed, not assumed.
  `getUserMedia` resolves after a permission prompt and a device start-up; a
  component that unmounts in that window has already run its cleanup, and in a
  single-page app nothing else will ever stop the stream. Go through
  `media-capture.ts`.
- A union with four members needs four answers where it reaches the athlete.
  `OfflineQueueFailure` models a full queue, a refused write, storage that would
  not open, and a changed account; one ternary sent the last two to free disk
  space, which cannot help either of them. `Record<Union, string>` makes the
  compiler demand an entry per member — it cannot demand that they differ, so
  test that too.
- A guard that watches one spelling guards one spelling. The Supabase
  `.error` rule was written for a client named `supabase` and looked straight
  past fifteen reads through a client passed in as an argument. Anchor a scan on
  what the code _does_ — `.from(`, `.rpc(` — not on what a variable is called,
  and assert the scan still matches something: a source scan that quietly finds
  nothing passes forever.
