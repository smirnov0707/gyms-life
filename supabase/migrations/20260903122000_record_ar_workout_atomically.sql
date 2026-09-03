-- Persist the short AR-camera set as one all-or-nothing history event. The
-- caller supplies an idempotency key generated when the set is completed, so
-- a retried request cannot create a second completed session.
create or replace function public.record_ar_workout(
  p_session_id uuid,
  p_exercise_slug text,
  p_exercise_name text,
  p_reps integer,
  p_weight_kg numeric,
  p_notes text default null
)
returns table (
  session_id uuid,
  session_plan_id uuid,
  session_day_index integer,
  session_title text,
  session_started_at timestamptz,
  session_finished_at timestamptz,
  session_duration_seconds integer,
  session_total_volume numeric,
  session_adaptation_modifier numeric,
  set_log_id uuid,
  set_log_exercise_slug text,
  set_log_exercise_name text,
  set_log_set_number integer,
  set_log_reps integer,
  set_log_weight_kg numeric,
  set_log_rpe numeric,
  set_log_done boolean,
  set_log_created_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := btrim(p_exercise_name);
  normalized_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  expected_title text;
  expected_volume numeric;
  saved_session public.workout_sessions%rowtype;
  saved_set_log public.set_logs%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to record an AR workout';
  end if;

  if p_exercise_slug !~ '^[a-z][a-z0-9-]{0,119}$' then
    raise exception 'Invalid AR exercise slug';
  end if;

  if length(normalized_name) not between 1 and 200 then
    raise exception 'Invalid AR exercise name';
  end if;

  if p_reps not between 1 and 100 then
    raise exception 'Invalid AR repetition count';
  end if;

  if p_weight_kg is null or p_weight_kg < 0 or p_weight_kg > 1000 then
    raise exception 'Invalid AR weight';
  end if;

  if normalized_notes is not null and length(normalized_notes) > 500 then
    raise exception 'AR notes are too long';
  end if;

  expected_title := 'AR · ' || normalized_name;
  expected_volume := p_weight_kg * p_reps;

  insert into public.workout_sessions (
    id,
    user_id,
    title,
    started_at,
    finished_at,
    duration_seconds,
    total_volume,
    notes
  )
  values (
    p_session_id,
    current_user_id,
    expected_title,
    now(),
    now(),
    0,
    expected_volume,
    normalized_notes
  )
  on conflict (id) do nothing
  returning * into saved_session;

  if saved_session.id is null then
    select *
      into saved_session
      from public.workout_sessions
     where id = p_session_id
       and user_id = current_user_id;

    if saved_session.id is null
      or saved_session.title is distinct from expected_title
      or saved_session.total_volume is distinct from expected_volume
      or saved_session.notes is distinct from normalized_notes
      or saved_session.finished_at is null then
      raise exception 'Invalid AR workout recording token';
    end if;
  end if;

  insert into public.set_logs (
    user_id,
    session_id,
    exercise_slug,
    exercise_name,
    set_number,
    reps,
    weight_kg,
    done
  )
  values (
    current_user_id,
    saved_session.id,
    p_exercise_slug,
    normalized_name,
    1,
    p_reps,
    p_weight_kg,
    true
  )
  on conflict (session_id, exercise_slug, set_number) do nothing
  returning * into saved_set_log;

  if saved_set_log.id is null then
    select *
      into saved_set_log
      from public.set_logs
     where session_id = saved_session.id
       and exercise_slug = p_exercise_slug
       and set_number = 1
       and user_id = current_user_id;

    if saved_set_log.id is null
      or saved_set_log.exercise_name is distinct from normalized_name
      or saved_set_log.reps is distinct from p_reps
      or saved_set_log.weight_kg is distinct from p_weight_kg
      or saved_set_log.done is not true then
      raise exception 'Invalid AR workout set recording token';
    end if;
  end if;

  return query
  select
    saved_session.id,
    saved_session.plan_id,
    saved_session.day_index,
    saved_session.title,
    saved_session.started_at,
    saved_session.finished_at,
    saved_session.duration_seconds,
    saved_session.total_volume,
    saved_session.adaptation_modifier,
    saved_set_log.id,
    saved_set_log.exercise_slug,
    saved_set_log.exercise_name,
    saved_set_log.set_number,
    saved_set_log.reps,
    saved_set_log.weight_kg,
    saved_set_log.rpe,
    saved_set_log.done,
    saved_set_log.created_at;
end;
$$;

revoke all on function public.record_ar_workout(uuid, text, text, integer, numeric, text)
  from public, anon;
grant execute on function public.record_ar_workout(uuid, text, text, integer, numeric, text)
  to authenticated, service_role;
