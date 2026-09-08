-- The timeline writer has never written anything.
--
-- `personal_timeline_events` was created with a *partial* unique index:
--
--   create unique index personal_timeline_source_event_unique
--     on public.personal_timeline_events(user_id, source_system, source_reference, event_type)
--     where source_reference is not null;
--
-- `recordPersonalTimelineEvent` upserts with
-- `onConflict: "user_id,source_system,source_reference,event_type"`, which
-- PostgREST turns into a plain `on conflict (cols)`. Postgres will not infer a
-- partial index from an inference clause that omits its predicate, and answers
--
--   42P10  there is no unique or exclusion constraint matching the
--          ON CONFLICT specification
--
-- Every write has failed since the writer was built. Production's observability
-- sink holds 233 `PERSONAL_TIMELINE_WRITE_FAILED` events — the largest single
-- entry in it — and `personal_timeline_events` holds zero rows. The writer
-- swallows its error on purpose, so that a failed index write can never cost an
-- athlete a finished workout, and that is right; it is also why this ran for
-- weeks unnoticed. An empty timeline looks exactly like a timeline of somebody
-- who has not done anything yet.
--
-- The predicate bought nothing. A unique index treats NULLs as distinct, so
-- rows with no `source_reference` never conflict with each other either way;
-- excluding them explicitly only made the index un-inferrable. Dropping it
-- restores the upsert and changes no uniqueness guarantee.
--
-- Do not put the predicate back. If a partial index is ever genuinely needed
-- here, the writer must send the predicate too, and PostgREST's `on_conflict`
-- cannot express one.

drop index if exists public.personal_timeline_source_event_unique;

create unique index if not exists personal_timeline_source_event_unique
  on public.personal_timeline_events(user_id, source_system, source_reference, event_type);

comment on index public.personal_timeline_source_event_unique is
  'Deliberately not partial. PostgREST upserts emit a bare on conflict (cols), '
  'which Postgres cannot match against a partial index (42P10) — the previous '
  'where source_reference is not null made every timeline write fail silently. '
  'NULL source_reference rows are non-conflicting under a plain unique index '
  'anyway, so the predicate guaranteed nothing it does not already guarantee.';
