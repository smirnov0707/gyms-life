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
