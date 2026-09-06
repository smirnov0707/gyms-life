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

Override **every** `VITE_` variable, including `VITE_SUPABASE_PROJECT_ID`. No
application code reads it, but Vite bakes every `VITE_` variable into the
client bundle, so a missed override leaves production's project id sitting in
a staging build. Nothing breaks — it just makes the bundle look like it
targets production when it does not, which is a bad thing to discover while
debugging something else.

## The database

The staging Supabase project is `yywnpovsqifwujuxdxog` (eu-west-2, free tier).
Its schema is a verified copy of production's.

### Why `supabase/schema.sql` exists

`supabase/migrations` cannot rebuild this database. Replaying it onto an empty
project stops at `20260830112535_remote_schema.sql`, which drops policies and
revokes grants on `ai_interactions`, `user_insights` and `user_memory` — three
tables that no migration in this repository creates. They were made outside
the migration history, and that file is a CLI-generated diff against that
state; `ai_interactions` does not even exist in production any more. The
migration chain describes a sequence of edits to a database it never built.

The consequence reached past staging: production's schema had no reproducible
source. If the database were lost, this repository could not rebuild it, and
there was no way to check that what is deployed matches what is committed.

`supabase/schema.sql` is that source. It was generated from production by
Postgres's own definition functions — `pg_get_constraintdef`,
`pg_get_indexdef`, `pg_get_functiondef`, `pg_get_triggerdef` and catalogue
introspection — so the DDL is the database's own description of itself, not a
hand transcription. `supabase/seed-exercises.sql` carries the public exercise
catalogue, extracted verbatim from the two migrations that populate it.

Neither file contains user data.

### Rebuilding from it

```sql
-- against an empty project
\i supabase/schema.sql
\i supabase/seed-exercises.sql
```

Note the two files that follow the schema through: a fresh Supabase project's
default privileges are wider than production's, so `schema.sql` revokes them
before re-granting exactly what production holds. Skipping that step leaves a
database quietly more permissive than the one it reproduces.

### How the copy was verified

Not by eye. Eight structural fingerprints were computed on both databases and
compared; every one matched.

| Fingerprint | Covers |
| ----------- | ------ |
| columns | every column's name, type, nullability and default |
| constraints | all 136, by definition text |
| indexes | all 82, by definition text |
| policies | all 32, by command, roles, `using` and `with check` |
| table grants | all 724 |
| column grants | the append-only consent columns, the hidden `health_token` |
| functions | all 13, by full body |
| triggers | all 7, plus the `auth.users` profile trigger |

The exercise catalogue was checked the same way: 175 rows, and an identical
content hash across all twelve columns.

One deliberate difference: `public.rls_auto_enable()` is omitted. It is
Supabase platform infrastructure present in every project and needs
event-trigger privileges to install.

Supabase's security advisors report the same two findings on staging as on
production, both expected: `app_observability_events` and
`paddle_webhook_events` have RLS enabled with no policies, which is how they
are meant to be — deny-all to every client role, server-side only.

### The app against it

Verified, not assumed. Built with the staging variables and run under
`wrangler dev`:

- the client bundle carries the staging project and no trace of production's
- the page issues exactly the expected catalogue read —
  `/rest/v1/exercises?select=*&order=muscle_group.asc,name_en.asc`
- the staging REST API answers that read with all 175 rows for the
  publishable key, under the `exercises readable` policy

RLS was probed directly at the same time, and staging enforces what
production is designed to enforce:

| Request as the anon key | Result |
| ----------------------- | ------ |
| read `exercises` | 200, 175 rows |
| read `profiles` | 200, empty — RLS filters every row |
| read `user_insights`, `decision_records` | 401, no grant |
| read `app_observability_events`, `paddle_webhook_events` | 401, no grant |
| insert into `exercises` | 401 |

One thing could not be checked here: the headless browser in this environment
cannot reach the internet, so the catalogue request failed at the network
layer rather than returning rows. Google Fonts failed identically. The request
itself was correct and the API answers it, so the gap is the sandbox, not the
app — but the full page has not been seen rendering real staging data.

### Keeping it true

`schema.sql` is a snapshot, and snapshots rot. When a migration changes
production's schema, regenerate it, or the baseline slowly stops describing
the database it claims to.
