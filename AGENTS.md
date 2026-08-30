# GYMS.LIFE engineering rules

- GYMS.LIFE is the central orchestrator and source of truth for user context.
- AI providers are replaceable specialists; never store user truth inside a provider.
- Keep secrets server-side. Never prefix provider secrets with `VITE_`.
- Supabase RLS is mandatory for user-owned data.
- Do not introduce vendor-specific AI gateway dependencies into business logic.
- Prefer deterministic trend detection and auditable insights before asking an LLM to interpret them.
- Test `npm run build` and `npm run lint` before production deployment.
