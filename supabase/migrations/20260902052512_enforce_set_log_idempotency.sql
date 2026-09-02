-- A client can retry a set after a network interruption. Keep the operation
-- idempotent at the database boundary as well as in the server function.
create unique index if not exists set_logs_session_exercise_set_unique
  on public.set_logs (session_id, exercise_slug, set_number);
