# Staging

A second, independent copy of gyms.life for loading a test build. It exists so
a change can be opened in a browser before it reaches the athlete using the
real app — on its own host, against its own database.

Production is untouched by everything here: it still builds through
`netlify.toml` and still talks to the production Supabase project.

## What it is made of

| Piece    | Production                          | Staging                              |
| -------- | ----------------------------------- | ------------------------------------ |
| Host     | Netlify (`netlify.toml`)            | Cloudflare Workers (`wrangler.jsonc`)|
| Build    | `npm run build`                     | `npm run build:staging`              |
| Database | Supabase `tqwqbjkjqzusohxdzupr`     | Supabase `yywnpovsqifwujuxdxog`      |

Cloudflare was chosen after looking at the build output rather than from
preference: `dist/server/server.js` is already
`export default { fetch(request, env, ctx) }`, which is the Workers module
format, and the bundle's only Node built-ins are `node:async_hooks` and
`node:crypto`, both covered by `nodejs_compat`. No adapter is needed, so
`npm run build:staging` simply skips the Netlify Vite plugin.

## Deploying

```bash
npm run build:staging
npx wrangler deploy
```

Run it locally first — this serves the real SSR app on http://localhost:8788:

```bash
npm run build:staging
npx wrangler dev
```

Local runs read secrets from `.dev.vars` (git-ignored). Deployed runs read them
from Cloudflare; set each with `npx wrangler secret put <NAME>`.

## Environment

Staging needs the same variables as production (see `.env.example`) with two
rules that are the entire point of having a staging environment:

- **The Supabase variables must point at the staging project**, never at
  `tqwqbjkjqzusohxdzupr`. A test environment that writes to the production
  database is not a test environment.
- **Use separate AI provider keys, or a low `AI_DAILY_REQUEST_LIMIT`.** The
  staging URL is reachable by anyone who has it, and every scan it runs spends
  the same paid quota as the real app.

`SUPABASE_SERVICE_ROLE_KEY` must be set for staging too. Without it the site
loads but every server path that uses `supabaseAdmin` — Paddle webhooks, AI
quota enforcement — fails.

## The database

The staging Supabase project is `yywnpovsqifwujuxdxog` (eu-west-2, free tier).

**Its schema is not yet complete, and the repository cannot complete it.**
Replaying `supabase/migrations` onto an empty database does not work:
`20260830112535_remote_schema.sql` drops policies and revokes grants on
`ai_interactions`, `user_insights` and `user_memory`, three tables that no
migration in this repository creates. They were created outside the migration
history in production, and that file is a CLI-generated diff against that
state — `ai_interactions` does not even exist in production any more.

The consequence reaches past staging: **production's schema has no
reproducible source.** If the database were lost, this repository could not
rebuild it, and there is no way to check that what is deployed matches what is
committed.

The fix is a baseline dump, which also unblocks staging. From a machine with
the production database password (Supabase dashboard → Project Settings →
Database):

```bash
supabase link --project-ref tqwqbjkjqzusohxdzupr
supabase db dump --schema public -f supabase/schema.sql
```

Commit `supabase/schema.sql`, then apply it to staging. After that, staging is
built from a file that is checked in, and the same file is the disaster-
recovery baseline production currently lacks.
