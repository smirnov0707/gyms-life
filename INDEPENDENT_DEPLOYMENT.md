# GYMS.LIFE — Independent deployment guide

This build is intended to run without Lovable.

## 1. Install

```bash
npm install
npm run build
npm run dev
```

The first install may take a few minutes because the project uses TanStack Start and the Netlify adapter.

## 2. Environment variables

Copy `.env.example` to `.env` for local development. Put production secrets in Netlify Environment Variables, not in GitHub.

Required for the application:
- `SUPABASE_URL`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Required for AI features:
- `GROQ_API_KEY` and/or `GEMINI_API_KEY`

Paddle production/sandbox variables are required only when the corresponding billing environment is used.

## 3. Supabase

Keep the existing Supabase project and run the migrations in `supabase/migrations`.

Configure:
- Google provider
- Site URL: `https://gyms.life`
- Redirect URLs for `https://gyms.life/auth` and `https://gyms.life/reset-password` as used by the app
- Custom SMTP for password reset / Auth email (Resend can be used)

## 4. Google OAuth

Use the Supabase callback URL as the Google Authorized redirect URI:

`https://YOUR_PROJECT.supabase.co/auth/v1/callback`

The exact URL must match the Supabase project.

## 5. Resend

Verify `gyms.life` in Resend and configure SPF/DKIM. Then configure Supabase Auth SMTP with the Resend SMTP credentials.

Recommended sender:
- `noreply@gyms.life`
- `GYMS.LIFE`

## 6. Netlify

Connect the GitHub repository and use:

- Build command: `npm run build`
- Publish directory: `dist/client`
- Node: 22

The repository already contains `netlify.toml` and the official `@netlify/vite-plugin-tanstack-start` adapter.

## 7. Domain

Do not change the `gyms.life` DNS until the Netlify preview URL has been fully tested. Then point the domain to Netlify and verify HTTPS.

## 8. AI architecture

`src/lib/ai-orchestrator.server.ts` is the central orchestration layer.

`src/lib/user-context.server.ts` is the central user-context builder.

`src/lib/ai-gateway.server.ts` is the provider router. It can select Groq, Gemini, or an OpenAI-compatible provider without changing the application feature code.

AI providers never become the source of truth for the user. Supabase + GYMS.LIFE own the context and history.

## 9. Intelligence

`src/lib/intelligence.functions.ts` provides deterministic first-pass monitoring for:
- workout consistency
- recovery/readiness
- body-weight trends
- proactive user insights

Insights are stored in `user_insights`. AI interpretation can be layered on top without changing the database source of truth.
