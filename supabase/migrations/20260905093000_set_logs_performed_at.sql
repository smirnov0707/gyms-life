-- Separate when a set was performed from when its row was written.
--
-- `created_at` defaults to now() at insert time. Online those are the same
-- instant, but the app queues sets offline and syncs them when signal
-- returns, so a set done at 19:00 in a basement gym could carry an 08:00
-- timestamp the next morning. The Twin's recovery model decays fatigue over
-- elapsed time, so that gap reports muscles as far more fatigued than they
-- are and dates the session to the wrong day.
--
-- The client already records the real instant when it queues a set; it was
-- being discarded at the sync boundary. This gives it somewhere to land.

alter table public.set_logs
  add column if not exists performed_at timestamptz;

-- Every existing row was written online, so its insert time is also its
-- performance time. This is a restatement of what we already know, not a
-- guess about history.
update public.set_logs
  set performed_at = created_at
  where performed_at is null;

alter table public.set_logs
  alter column performed_at set default now(),
  alter column performed_at set not null;

-- The Twin's muscle-load read filters and orders by this column per user;
-- it replaces created_at in that path, so it needs the same index shape.
create index if not exists set_logs_user_performed_idx
  on public.set_logs using btree (user_id, performed_at desc);

comment on column public.set_logs.performed_at is
  'When the set was actually performed, as reported by the client and bounded server-side. Use this for anything time-based; created_at is the row write time.';
