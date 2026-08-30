# GYMS.LIFE

Independent production-ready GYMS.LIFE application.

## Stack
- TanStack Start + React + Vite
- Supabase Auth + PostgreSQL
- Direct AI provider routing (Groq / Gemini / OpenAI-compatible providers)
- Paddle subscriptions
- Resend SMTP for Auth email
- Netlify deployment

## Local setup
1. Copy `.env.example` to `.env`.
2. Fill the server AI/Paddle/Resend variables as needed.
3. Run `npm install`.
4. Run `npm run dev`.
5. Run `npm run build` before deployment.

GYMS.LIFE is the central orchestrator and source of truth for user context; AI providers are replaceable specialists.
