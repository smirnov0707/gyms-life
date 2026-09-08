-- Future Lab Phase 4 foundation: a record of background work that actually ran.
--
-- Until now every calculation in this product happened inside a request. There
-- was no place for work to run while nobody was looking, which is why the
-- Night Lab described in the constitution does not exist: not because the
-- analysis is unwritten, but because there is nowhere to run it and no way to
-- prove afterwards that it ran.
--
-- This table is that proof. "While you slept, GYMS.LIFE learned" may only be
-- said when there is a succeeded row here to point at, and the Morning Brief
-- reads it rather than assuming it.
--
-- The four properties the constitution asks of a background job map onto
-- columns here:
--
--   idempotent  — (job_name, run_key) is unique, so a schedule that fires
--                 twice, or a retry after a timeout, claims nothing new.
--   observable  — status, counts and error_code are written by the job itself,
--                 not inferred from logs.
--   retry-safe  — a `running` row carries `started_at`, so a run abandoned by
--                 a crashed container can be reclaimed after its lease expires
--                 instead of blocking the job forever.
--   bounded     — window_start/window_end and `attempted` record the slice of
--                 work the run was allowed to touch. A job that cannot say how
--                 much it looked at cannot be trusted to have finished.

create table if not exists public.background_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  -- One run per job per period. The job decides the period; the uniqueness is
  -- enforced here so two schedulers racing produce one run, not two.
  run_key text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- The slice of time the run was allowed to consider.
  window_start timestamptz not null,
  window_end timestamptz not null,
  -- What the run touched. Attempted is the bound; succeeded and failed are
  -- what happened, and they are recorded per item so one athlete's failure
  -- never silently becomes the whole night's failure.
  attempted integer not null default 0,
  succeeded integer not null default 0,
  failed integer not null default 0,
  error_code text,
  created_at timestamptz not null default now(),
  constraint background_job_name_format check (job_name ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint background_job_run_key_format check (run_key ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  constraint background_job_status check (status in ('running', 'succeeded', 'failed')),
  constraint background_job_error_code_format check (error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  constraint background_job_counts_nonnegative check (attempted >= 0 and succeeded >= 0 and failed >= 0),
  -- A run cannot claim more results than it attempted.
  constraint background_job_counts_bounded check (succeeded + failed <= attempted),
  constraint background_job_window_ordered check (window_end >= window_start),
  -- A finished run has a status that is not `running`, and vice versa.
  constraint background_job_finished_status check (
    (status = 'running' and finished_at is null)
    or (status <> 'running' and finished_at is not null)
  )
);

create unique index if not exists background_job_runs_identity_unique
  on public.background_job_runs(job_name, run_key);

create index if not exists background_job_runs_recent_idx
  on public.background_job_runs(job_name, started_at desc);

alter table public.background_job_runs enable row level security;
revoke all on table public.background_job_runs from anon, authenticated;
grant all on table public.background_job_runs to service_role;

comment on table public.background_job_runs is
  'Ledger of background work that actually ran. Written by the service role in '
  'src/lib/background-job.server.ts and read by nobody through the API. RLS is '
  'enabled with no policies on purpose: these rows are about the system, not '
  'about any one athlete, and no client role has access. The linter''s '
  'rls_enabled_no_policy INFO on this table is expected — do not silence it by '
  'adding a policy. Nothing in the product may claim overnight analysis '
  'happened without a succeeded row here to point at.';
