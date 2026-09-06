-- gyms.life — public schema baseline
--
-- Generated from the production database (tqwqbjkjqzusohxdzupr) by Postgres's
-- own definition functions: pg_get_constraintdef, pg_get_indexdef,
-- pg_get_functiondef, pg_get_triggerdef and pg_catalog introspection.
--
-- WHY THIS FILE EXISTS
--
-- `supabase/migrations` cannot rebuild this database. Replaying it onto an
-- empty project stops at 20260830112535_remote_schema.sql, which drops
-- policies and revokes grants on ai_interactions, user_insights and
-- user_memory — tables no migration in this repository creates. They were
-- made outside the migration history, and that file is a CLI-generated diff
-- against that state. So the migration chain describes a sequence of edits to
-- a database it never built.
--
-- This file is the missing piece: the current shape of production, in one
-- place, replayable from nothing. It is the disaster-recovery baseline and
-- the source staging is built from.
--
-- Schema only. No user data. The exercise catalogue is reference data and
-- lives in supabase/seed-exercises.sql.
--
-- Deliberately omitted: public.rls_auto_enable(), which is Supabase platform
-- infrastructure present in every project and requires event-trigger
-- privileges to install.

-- ============================================================ types

create type public.app_role as enum ('admin', 'user');

-- ============================================================ tables

create table public.ai_personalization_consents (
  id bigint not null,
  user_id uuid not null,
  granted boolean not null,
  policy_version text not null,
  recorded_at timestamp with time zone not null default now()
);

create table public.ai_usage_daily (
  user_id uuid not null,
  usage_date date not null default CURRENT_DATE,
  request_count integer not null default 0,
  updated_at timestamp with time zone not null default now()
);

create table public.app_observability_events (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  event_name text not null,
  outcome text not null,
  user_id uuid,
  duration_ms integer,
  error_code text,
  metadata jsonb not null default '{}'::jsonb
);

create table public.athlete_state_snapshots (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  schema_version text not null,
  state jsonb not null,
  state_fingerprint text not null,
  computed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  calculation_version text not null default 'digital-athlete-v1'::text,
  source_window_start timestamp with time zone,
  source_window_end timestamp with time zone,
  provenance_summary jsonb not null default '{}'::jsonb,
  uncertainty_summary jsonb not null default '{}'::jsonb
);

create table public.body_metrics (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  measured_on date not null default CURRENT_DATE,
  weight_kg numeric,
  body_fat numeric,
  waist_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  created_at timestamp with time zone not null default now(),
  hips_cm numeric,
  thigh_cm numeric,
  neck_cm numeric
);

create table public.coach_messages (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  role text not null,
  content text not null,
  lang text,
  created_at timestamp with time zone not null default now()
);

create table public.daily_checkins (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  checkin_on date not null default CURRENT_DATE,
  sleep_hours numeric,
  sleep_quality integer,
  soreness integer,
  stress integer,
  energy integer,
  mood integer,
  readiness_score integer,
  advice text,
  load_modifier numeric,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.decision_evidence (
  id uuid not null default gen_random_uuid(),
  decision_id uuid not null,
  evidence_key text not null,
  evidence_value text not null,
  source_class text not null,
  "position" smallint not null,
  created_at timestamp with time zone not null default now()
);

create table public.decision_outcomes (
  id uuid not null default gen_random_uuid(),
  decision_id uuid not null,
  outcome text not null,
  recorded_at timestamp with time zone not null default now()
);

create table public.decision_records (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  athlete_state_snapshot_id uuid not null,
  decision_on date not null,
  engine_version text not null,
  decision_type text not null default 'today'::text,
  action text not null,
  alternatives text[] not null default '{}'::text[],
  confidence smallint not null default 0,
  safety_constraints text[] not null default '{}'::text[],
  status text not null default 'active'::text,
  created_at timestamp with time zone not null default now(),
  decision_fingerprint text not null,
  decision_basis text not null default 'current_day_fact'::text,
  prediction jsonb,
  uncertainty jsonb,
  safety_check jsonb,
  model_versions jsonb not null default '{}'::jsonb,
  user_override jsonb
);

create table public.exercises (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  name_lt text not null,
  name_en text not null,
  muscle_group text not null,
  equipment text not null,
  location text not null default 'both'::text,
  difficulty text not null default 'beginner'::text,
  instructions_lt text,
  instructions_en text,
  mistakes_lt text,
  mistakes_en text,
  video_key text,
  created_at timestamp with time zone not null default now()
);

create table public.form_analyses (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  exercise_slug text not null,
  exercise_name text not null,
  score integer,
  verdict text,
  good text,
  fixes text,
  drills text,
  created_at timestamp with time zone not null default now()
);

create table public.health_samples (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  sample_on date not null default CURRENT_DATE,
  source text not null default 'manual'::text,
  resting_hr numeric,
  hrv_ms numeric,
  sleep_hours numeric,
  sleep_quality integer,
  steps integer,
  active_kcal numeric,
  vo2max numeric,
  recovery_score integer,
  raw jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.hydration_logs (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  logged_on date not null,
  amount_ml integer not null,
  consumed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

create table public.meal_plans (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  goal text,
  diet text,
  allergies text,
  dislikes text,
  kcal_target integer,
  protein_target integer,
  carbs_target integer,
  fat_target integer,
  is_active boolean not null default true,
  data jsonb not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  lang text not null default 'lt'::text,
  i18n jsonb not null default '{}'::jsonb
);

create table public.nutrition_logs (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  logged_on date not null default ((now() AT TIME ZONE 'utc'::text))::date,
  description text not null,
  food_name text not null,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  note text,
  created_at timestamp with time zone not null default now(),
  source text
);

create table public.paddle_webhook_events (
  event_id text not null,
  event_type text not null,
  environment text not null,
  received_at timestamp with time zone not null default now()
);

create table public.personal_timeline_events (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null,
  occurred_at timestamp with time zone not null,
  timezone text,
  provenance text not null,
  quality text not null default 'unknown'::text,
  source_system text not null,
  source_table text,
  source_reference text,
  schema_version text not null default '1.0'::text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table public.plans (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  goal text,
  weeks integer not null default 8,
  days_per_week integer not null default 3,
  is_active boolean not null default true,
  data jsonb not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  lang text not null default 'lt'::text,
  i18n jsonb not null default '{}'::jsonb
);

create table public.profiles (
  id uuid not null,
  display_name text,
  locale text not null default 'lt'::text,
  birth_year integer,
  gender text,
  height_cm numeric,
  weight_kg numeric,
  target_weight_kg numeric,
  experience text,
  goal text,
  location text,
  days_per_week integer,
  session_minutes integer,
  equipment text[] not null default '{}'::text[],
  limitations text,
  onboarded boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  diet text,
  allergies text,
  dislikes text,
  meals_per_day integer,
  health_token uuid not null default gen_random_uuid(),
  time_zone text not null default 'UTC'::text
);

create table public.reminders (
  user_id uuid not null,
  workout_time time without time zone not null default '18:00:00'::time without time zone,
  water_reminders boolean not null default true,
  pre_workout_alert boolean not null default true,
  evening_recovery boolean not null default true,
  updated_at timestamp with time zone not null default now()
);

create table public.set_logs (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid not null,
  exercise_slug text not null,
  exercise_name text not null,
  set_number integer not null,
  reps integer,
  weight_kg numeric,
  rpe numeric,
  done boolean not null default true,
  created_at timestamp with time zone not null default now(),
  performed_at timestamp with time zone not null default now()
);

create table public.subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  paddle_subscription_id text not null,
  paddle_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active'::text,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.supplements (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  dose text,
  category text not null default 'general'::text,
  times_per_day integer not null default 1,
  with_food boolean not null default false,
  preferred_time text not null default 'any'::text,
  notes text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.training_rhythms (
  user_id uuid not null,
  preferred_weekdays smallint[] not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.user_insights (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  insight_type text not null,
  severity text not null,
  title text not null,
  body text not null,
  fingerprint text not null,
  source jsonb not null default '{}'::jsonb,
  status text not null default 'new'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.user_memory (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  memory_type text not null,
  content text not null,
  source text not null default 'system'::text,
  confidence numeric(4,3) not null default 0.500,
  importance numeric(4,3) not null default 0.500,
  status text not null default 'active'::text,
  first_seen_at timestamp with time zone not null default now(),
  last_confirmed_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  memory_key text,
  value jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  superseded_by uuid
);

create table public.user_roles (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null
);

create table public.vbt_logs (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  exercise_slug text not null,
  weight_kg numeric not null,
  avg_velocity numeric not null,
  peak_velocity numeric not null,
  velocity_loss_pct numeric not null default 0,
  created_at timestamp with time zone not null default now()
);

create table public.vision_meal_scans (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  dish_name text not null,
  calories numeric not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  items text[] not null default '{}'::text[],
  image_url text,
  created_at timestamp with time zone not null default now()
);

create table public.workout_sessions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  plan_id uuid,
  day_index integer,
  title text,
  started_at timestamp with time zone not null default now(),
  finished_at timestamp with time zone,
  duration_seconds integer,
  total_volume numeric not null default 0,
  feeling integer,
  notes text,
  created_at timestamp with time zone not null default now(),
  adaptation_modifier numeric not null default 1,
  workout_snapshot jsonb
);

alter table public.ai_personalization_consents alter column id add generated always as identity;

-- ============================================================ functions
-- Declared after the tables because several reference table rowtypes, and
-- before the constraints because training_rhythms_weekdays_unique calls one.

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $function$
;

CREATE OR REPLACE FUNCTION public.training_rhythm_weekdays_are_unique(value smallint[])
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE STRICT
 SET search_path TO 'pg_catalog'
AS $function$
  select cardinality(value) = (
    select count(distinct weekday)
    from unnest(value) as weekday
  );
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_workout_snapshot_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.workout_snapshot is distinct from old.workout_snapshot then
    raise exception using
      errcode = '22023',
      message = 'Workout execution snapshot is immutable after session creation.';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live'::text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
    and environment = check_env
    and (
      (status in ('active', 'trialing', 'past_due') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$function$
;

CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_user_id uuid, p_limit integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_count integer;
  effective_limit integer := least(greatest(coalesce(p_limit, 1), 1), 500);
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  insert into public.ai_usage_daily(user_id, usage_date, request_count, updated_at)
  values (p_user_id, current_date, 1, now())
  on conflict (user_id, usage_date) do update
    set request_count = public.ai_usage_daily.request_count + 1,
        updated_at = now()
    where public.ai_usage_daily.request_count < effective_limit
  returning request_count into new_count;

  return new_count is not null and new_count <= effective_limit;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.activate_meal_plan(p_meal_plan_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  current_user_id uuid := auth.uid();
  selected_meal_plan_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to activate a meal plan';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  select id
    into selected_meal_plan_id
    from public.meal_plans
   where id = p_meal_plan_id
     and user_id = current_user_id;

  if selected_meal_plan_id is null then
    raise exception 'Meal plan not found';
  end if;

  update public.meal_plans
     set is_active = false
   where user_id = current_user_id
     and is_active = true
     and id <> selected_meal_plan_id;

  update public.meal_plans
     set is_active = true
   where id = selected_meal_plan_id
     and user_id = current_user_id;

  return selected_meal_plan_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.activate_training_plan(p_plan_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  current_user_id uuid := auth.uid();
  selected_plan_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to activate a training plan';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  select id
    into selected_plan_id
    from public.plans
   where id = p_plan_id
     and user_id = current_user_id;

  if selected_plan_id is null then
    raise exception 'Training plan not found';
  end if;

  update public.plans
     set is_active = false
   where user_id = current_user_id
     and is_active = true
     and id <> selected_plan_id;

  update public.plans
     set is_active = true
   where id = selected_plan_id
     and user_id = current_user_id;

  return selected_plan_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.correct_user_memory(p_user_id uuid, p_memory_id uuid, p_content text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_existing public.user_memory%rowtype;
  v_new_id uuid;
  v_content text := btrim(p_content);
begin
  if v_content is null or char_length(v_content) not between 1 and 400 then
    raise exception 'Corrected memory content must contain 1 to 400 characters.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from public.user_memory
  where id = p_memory_id
    and user_id = p_user_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'Memory entry was not found.' using errcode = 'P0002';
  end if;

  if v_existing.memory_type = 'current_context' then
    raise exception 'Current context must be updated through its dedicated flow.'
      using errcode = '22023';
  end if;

  update public.user_memory
  set
    status = 'corrected',
    updated_at = now()
  where id = v_existing.id
    and status = 'active';

  insert into public.user_memory (
    user_id,
    memory_type,
    memory_key,
    content,
    value,
    evidence_refs,
    source,
    confidence,
    importance,
    status,
    last_confirmed_at,
    expires_at
  ) values (
    v_existing.user_id,
    v_existing.memory_type,
    v_existing.memory_key,
    v_content,
    null,
    '[]'::jsonb,
    'user_reported',
    1,
    v_existing.importance,
    'active',
    now(),
    null
  ) returning id into v_new_id;

  update public.user_memory
  set
    superseded_by = v_new_id,
    updated_at = now()
  where id = v_existing.id;

  return v_new_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.replace_active_life_context(p_user_id uuid, p_memory_key text, p_content text, p_value jsonb, p_importance numeric, p_expires_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_new_id uuid;
  v_replaced_ids uuid[];
begin
  if p_memory_key !~ '^life_context:[a-z_]{2,64}$' then
    raise exception 'Invalid life-context key.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_value) <> 'object' then
    raise exception 'Life-context value must be an object.' using errcode = '22023';
  end if;

  if p_expires_at <= now() then
    raise exception 'Life-context expiry must be in the future.' using errcode = '22023';
  end if;

  with replaced as (
    update public.user_memory
    set
      status = case when expires_at is not null and expires_at <= now() then 'expired' else 'superseded' end,
      updated_at = now()
    where user_id = p_user_id
      and memory_type = 'current_context'
      and memory_key = p_memory_key
      and status = 'active'
    returning id, status
  )
  select array_agg(id) filter (where status = 'superseded')
  into v_replaced_ids
  from replaced;

  insert into public.user_memory (
    user_id,
    memory_type,
    memory_key,
    content,
    value,
    evidence_refs,
    source,
    confidence,
    importance,
    status,
    expires_at
  ) values (
    p_user_id,
    'current_context',
    p_memory_key,
    p_content,
    p_value,
    '[]'::jsonb,
    'user_reported',
    1,
    p_importance,
    'active',
    p_expires_at
  ) returning id into v_new_id;

  if v_replaced_ids is not null then
    update public.user_memory
    set superseded_by = v_new_id
    where id = any(v_replaced_ids);
  end if;

  return v_new_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reconcile_calculated_user_memory(p_user_id uuid, p_entries jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_entry jsonb;
  v_memory_key text;
  v_memory_type text;
  v_content text;
  v_value jsonb;
  v_evidence_refs jsonb;
  v_confidence numeric;
  v_importance numeric;
  v_keys text[] := array[]::text[];
  v_existing public.user_memory%rowtype;
  v_new_id uuid;
begin
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) > 5 then
    raise exception 'Calculated memory entries must be an array of at most five items.'
      using errcode = '22023';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    if jsonb_typeof(v_entry) <> 'object' then
      raise exception 'Calculated memory entry must be an object.' using errcode = '22023';
    end if;

    v_memory_key := v_entry ->> 'memory_key';
    v_memory_type := v_entry ->> 'memory_type';
    v_content := btrim(v_entry ->> 'content');
    v_value := v_entry -> 'value';
    v_evidence_refs := v_entry -> 'evidence_refs';

    if v_memory_key is null or v_memory_key not in (
      'derived:training_consistency_28d',
      'derived:recovery_low_7d',
      'derived:weight_change_30d',
      'derived:nutrition_logging_14d',
      'derived:training_rhythm_observation_28d'
    ) then
      raise exception 'Unsupported calculated memory key.' using errcode = '22023';
    end if;

    if v_memory_key = any(v_keys) then
      raise exception 'Calculated memory keys must be unique.' using errcode = '22023';
    end if;
    v_keys := array_append(v_keys, v_memory_key);

    if (v_memory_key = 'derived:training_consistency_28d' and v_memory_type <> 'training_pattern')
      or (v_memory_key = 'derived:recovery_low_7d' and v_memory_type <> 'recovery_pattern')
      or (v_memory_key = 'derived:weight_change_30d' and v_memory_type <> 'discovery')
      or (v_memory_key = 'derived:nutrition_logging_14d' and v_memory_type <> 'nutrition_pattern')
      or (v_memory_key = 'derived:training_rhythm_observation_28d' and v_memory_type <> 'behavior') then
      raise exception 'Calculated memory type does not match its key.' using errcode = '22023';
    end if;

    if v_content is null or char_length(v_content) not between 1 and 400 then
      raise exception 'Calculated memory content must contain 1 to 400 characters.'
        using errcode = '22023';
    end if;

    if jsonb_typeof(v_value) <> 'object' or jsonb_typeof(v_evidence_refs) <> 'array'
      or jsonb_array_length(v_evidence_refs) not between 1 and 4 then
      raise exception 'Calculated memory requires a value object and bounded evidence references.'
        using errcode = '22023';
    end if;

    if jsonb_typeof(v_entry -> 'confidence') <> 'number'
      or jsonb_typeof(v_entry -> 'importance') <> 'number' then
      raise exception 'Calculated memory confidence and importance must be numbers.'
        using errcode = '22023';
    end if;
    v_confidence := (v_entry ->> 'confidence')::numeric;
    v_importance := (v_entry ->> 'importance')::numeric;
    if v_confidence not between 0 and 1 or v_importance not between 0 and 1 then
      raise exception 'Calculated memory confidence and importance must be between zero and one.'
        using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || v_memory_key, 0));
    select *
    into v_existing
    from public.user_memory
    where user_id = p_user_id
      and memory_key = v_memory_key
      and status = 'active'
    for update;

    if found and v_existing.source = 'calculated' then
      if v_existing.memory_type = v_memory_type
        and v_existing.content = v_content
        and v_existing.value = v_value
        and v_existing.confidence = v_confidence
        and v_existing.importance = v_importance then
        update public.user_memory
        set
          evidence_refs = v_evidence_refs,
          last_confirmed_at = now(),
          updated_at = now()
        where id = v_existing.id;
      else
        update public.user_memory
        set status = 'superseded', updated_at = now()
        where id = v_existing.id;

        insert into public.user_memory (
          user_id, memory_type, memory_key, content, value, evidence_refs,
          source, confidence, importance, status, last_confirmed_at
        ) values (
          p_user_id, v_memory_type, v_memory_key, v_content, v_value, v_evidence_refs,
          'calculated', v_confidence, v_importance, 'active', now()
        ) returning id into v_new_id;

        update public.user_memory
        set superseded_by = v_new_id, updated_at = now()
        where id = v_existing.id;
      end if;
    elsif not found then
      insert into public.user_memory (
        user_id, memory_type, memory_key, content, value, evidence_refs,
        source, confidence, importance, status, last_confirmed_at
      ) values (
        p_user_id, v_memory_type, v_memory_key, v_content, v_value, v_evidence_refs,
        'calculated', v_confidence, v_importance, 'active', now()
      );
    end if;
  end loop;

  -- Only system-generated candidates are reconciled. User-reported entries,
  -- including corrections of a prior calculated claim, remain under user control.
  update public.user_memory
  set status = 'superseded', updated_at = now()
  where user_id = p_user_id
    and source = 'calculated'
    and status = 'active'
    and memory_key like 'derived:%'
    and not (memory_key = any(v_keys));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_ar_workout(p_session_id uuid, p_exercise_slug text, p_exercise_name text, p_reps integer, p_weight_kg numeric, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(session_id uuid, session_plan_id uuid, session_day_index integer, session_title text, session_started_at timestamp with time zone, session_finished_at timestamp with time zone, session_duration_seconds integer, session_total_volume numeric, session_adaptation_modifier numeric, set_log_id uuid, set_log_exercise_slug text, set_log_exercise_name text, set_log_set_number integer, set_log_reps integer, set_log_weight_kg numeric, set_log_rpe numeric, set_log_done boolean, set_log_created_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- ============================================================ constraints

alter table public.ai_personalization_consents add constraint ai_personalization_consents_pkey PRIMARY KEY (id);
alter table public.ai_usage_daily add constraint ai_usage_daily_pkey PRIMARY KEY (user_id, usage_date);
alter table public.app_observability_events add constraint app_observability_events_pkey PRIMARY KEY (id);
alter table public.athlete_state_snapshots add constraint athlete_state_snapshots_pkey PRIMARY KEY (id);
alter table public.body_metrics add constraint body_metrics_pkey PRIMARY KEY (id);
alter table public.coach_messages add constraint coach_messages_pkey PRIMARY KEY (id);
alter table public.daily_checkins add constraint daily_checkins_pkey PRIMARY KEY (id);
alter table public.decision_evidence add constraint decision_evidence_pkey PRIMARY KEY (id);
alter table public.decision_outcomes add constraint decision_outcomes_pkey PRIMARY KEY (id);
alter table public.decision_records add constraint decision_records_pkey PRIMARY KEY (id);
alter table public.exercises add constraint exercises_pkey PRIMARY KEY (id);
alter table public.form_analyses add constraint form_analyses_pkey PRIMARY KEY (id);
alter table public.health_samples add constraint health_samples_pkey PRIMARY KEY (id);
alter table public.hydration_logs add constraint hydration_logs_pkey PRIMARY KEY (id);
alter table public.meal_plans add constraint meal_plans_pkey PRIMARY KEY (id);
alter table public.nutrition_logs add constraint nutrition_logs_pkey PRIMARY KEY (id);
alter table public.paddle_webhook_events add constraint paddle_webhook_events_pkey PRIMARY KEY (event_id);
alter table public.personal_timeline_events add constraint personal_timeline_events_pkey PRIMARY KEY (id);
alter table public.plans add constraint plans_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.reminders add constraint reminders_pkey PRIMARY KEY (user_id);
alter table public.set_logs add constraint set_logs_pkey PRIMARY KEY (id);
alter table public.subscriptions add constraint subscriptions_pkey PRIMARY KEY (id);
alter table public.supplements add constraint supplements_pkey PRIMARY KEY (id);
alter table public.training_rhythms add constraint training_rhythms_pkey PRIMARY KEY (user_id);
alter table public.user_insights add constraint user_insights_pkey PRIMARY KEY (id);
alter table public.user_memory add constraint user_memory_pkey PRIMARY KEY (id);
alter table public.user_roles add constraint user_roles_pkey PRIMARY KEY (id);
alter table public.vbt_logs add constraint vbt_logs_pkey PRIMARY KEY (id);
alter table public.vision_meal_scans add constraint vision_meal_scans_pkey PRIMARY KEY (id);
alter table public.workout_sessions add constraint workout_sessions_pkey PRIMARY KEY (id);

alter table public.athlete_state_snapshots add constraint athlete_state_snapshots_user_fingerprint_unique UNIQUE (user_id, state_fingerprint);
alter table public.daily_checkins add constraint daily_checkins_user_id_checkin_on_key UNIQUE (user_id, checkin_on);
alter table public.decision_evidence add constraint decision_evidence_decision_position_unique UNIQUE (decision_id, "position");
alter table public.decision_outcomes add constraint decision_outcomes_decision_id_key UNIQUE (decision_id);
alter table public.decision_records add constraint decision_records_daily_fingerprint_engine_unique UNIQUE (user_id, decision_on, decision_fingerprint, engine_version);
alter table public.exercises add constraint exercises_slug_key UNIQUE (slug);
alter table public.health_samples add constraint health_samples_user_id_sample_on_source_key UNIQUE (user_id, sample_on, source);
alter table public.subscriptions add constraint subscriptions_paddle_subscription_id_key UNIQUE (paddle_subscription_id);
alter table public.user_insights add constraint user_insights_user_id_fingerprint_key UNIQUE (user_id, fingerprint);
alter table public.user_roles add constraint user_roles_user_id_role_key UNIQUE (user_id, role);

alter table public.ai_personalization_consents add constraint ai_personalization_consents_policy_version_check CHECK (((char_length(TRIM(BOTH FROM policy_version)) >= 1) AND (char_length(TRIM(BOTH FROM policy_version)) <= 64)));
alter table public.ai_usage_daily add constraint ai_usage_daily_request_count_check CHECK ((request_count >= 0));
alter table public.app_observability_events add constraint app_observability_events_duration_range CHECK (((duration_ms IS NULL) OR ((duration_ms >= 0) AND (duration_ms <= 86400000))));
alter table public.app_observability_events add constraint app_observability_events_error_code_format CHECK (((error_code IS NULL) OR (error_code ~ '^[A-Z][A-Z0-9_]{2,99}$'::text)));
alter table public.app_observability_events add constraint app_observability_events_event_name_format CHECK ((event_name ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'::text));
alter table public.app_observability_events add constraint app_observability_events_metadata_is_object CHECK ((jsonb_typeof(metadata) = 'object'::text));
alter table public.app_observability_events add constraint app_observability_events_outcome CHECK ((outcome = ANY (ARRAY['success'::text, 'failure'::text])));
alter table public.athlete_state_snapshots add constraint athlete_state_snapshots_fingerprint_length CHECK ((char_length(state_fingerprint) = 64));
alter table public.athlete_state_snapshots add constraint athlete_state_snapshots_provenance_object CHECK ((jsonb_typeof(provenance_summary) = 'object'::text));
alter table public.athlete_state_snapshots add constraint athlete_state_snapshots_schema_version_format CHECK ((schema_version ~ '^[1-9][0-9]*[.][0-9]+$'::text));
alter table public.athlete_state_snapshots add constraint athlete_state_snapshots_source_window_order CHECK (((source_window_start IS NULL) OR (source_window_end IS NULL) OR (source_window_start <= source_window_end)));
alter table public.athlete_state_snapshots add constraint athlete_state_snapshots_state_object CHECK ((jsonb_typeof(state) = 'object'::text));
alter table public.athlete_state_snapshots add constraint athlete_state_snapshots_uncertainty_object CHECK ((jsonb_typeof(uncertainty_summary) = 'object'::text));
alter table public.body_metrics add constraint body_metrics_body_fat_range CHECK (((body_fat IS NULL) OR ((body_fat >= (0)::numeric) AND (body_fat <= (100)::numeric)))) NOT VALID;
alter table public.body_metrics add constraint body_metrics_circumference_ranges CHECK ((((waist_cm IS NULL) OR ((waist_cm > (0)::numeric) AND (waist_cm <= (300)::numeric))) AND ((chest_cm IS NULL) OR ((chest_cm > (0)::numeric) AND (chest_cm <= (300)::numeric))) AND ((hips_cm IS NULL) OR ((hips_cm > (0)::numeric) AND (hips_cm <= (300)::numeric))) AND ((arm_cm IS NULL) OR ((arm_cm > (0)::numeric) AND (arm_cm <= (150)::numeric))) AND ((thigh_cm IS NULL) OR ((thigh_cm > (0)::numeric) AND (thigh_cm <= (200)::numeric))) AND ((neck_cm IS NULL) OR ((neck_cm > (0)::numeric) AND (neck_cm <= (150)::numeric))))) NOT VALID;
alter table public.body_metrics add constraint body_metrics_weight_kg_range CHECK (((weight_kg IS NULL) OR ((weight_kg > (0)::numeric) AND (weight_kg <= (500)::numeric)))) NOT VALID;
alter table public.coach_messages add constraint coach_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'coach'::text])));
alter table public.decision_evidence add constraint decision_evidence_key CHECK ((evidence_key = ANY (ARRAY['active_training_plan'::text, 'today_readiness'::text, 'completed_workout_today'::text, 'sessions_last_7_days'::text, 'load_modifier'::text, 'model_data_quality'::text, 'active_life_context'::text, 'recent_decision_feedback'::text, 'training_rhythm'::text, 'recent_training_response'::text])));
alter table public.decision_evidence add constraint decision_evidence_position CHECK ((("position" >= 0) AND ("position" <= 10)));
alter table public.decision_evidence add constraint decision_evidence_source_class CHECK ((source_class = ANY (ARRAY['user_reported'::text, 'calculated'::text, 'system_generated'::text])));
alter table public.decision_evidence add constraint decision_evidence_value_length CHECK (((char_length(evidence_value) >= 1) AND (char_length(evidence_value) <= 100)));
alter table public.decision_outcomes add constraint decision_outcomes_outcome CHECK ((outcome = ANY (ARRAY['accepted'::text, 'dismissed'::text, 'completed'::text, 'not_helpful'::text])));
alter table public.decision_records add constraint decision_records_action CHECK ((action = ANY (ARRAY['generate_training_plan'::text, 'complete_readiness'::text, 'recover'::text, 'train_adapted'::text, 'train_as_planned'::text, 'log_nutrition'::text])));
alter table public.decision_records add constraint decision_records_alternatives_valid CHECK ((alternatives <@ ARRAY['generate_training_plan'::text, 'complete_readiness'::text, 'recover'::text, 'train_adapted'::text, 'train_as_planned'::text, 'log_nutrition'::text]));
alter table public.decision_records add constraint decision_records_confidence_range CHECK (((confidence >= 0) AND (confidence <= 100)));
alter table public.decision_records add constraint decision_records_decision_basis_valid CHECK ((decision_basis = ANY (ARRAY['safety_rule'::text, 'current_day_fact'::text, 'current_checkin'::text, 'observed_pattern'::text])));
alter table public.decision_records add constraint decision_records_engine_version_format CHECK ((engine_version ~ '^[1-9][0-9]*[.][0-9]+$'::text));
alter table public.decision_records add constraint decision_records_fingerprint_length CHECK ((char_length(decision_fingerprint) = 64));
alter table public.decision_records add constraint decision_records_model_versions_object CHECK ((jsonb_typeof(model_versions) = 'object'::text));
alter table public.decision_records add constraint decision_records_prediction_object CHECK (((prediction IS NULL) OR (jsonb_typeof(prediction) = 'object'::text)));
alter table public.decision_records add constraint decision_records_safety_check_object CHECK (((safety_check IS NULL) OR (jsonb_typeof(safety_check) = 'object'::text)));
alter table public.decision_records add constraint decision_records_safety_constraints_valid CHECK ((safety_constraints <@ ARRAY['requires_active_plan_before_training'::text, 'do_not_adapt_load_without_today_checkin'::text, 'avoid_progression_when_readiness_low'::text, 'apply_persisted_readiness_modifier'::text, 'apply_persisted_execution_snapshot'::text, 'apply_training_response_volume_guard'::text, 'avoid_duplicate_training_prompt'::text, 'avoid_training_with_active_limitation'::text]));
alter table public.decision_records add constraint decision_records_status CHECK ((status = ANY (ARRAY['active'::text, 'accepted'::text, 'dismissed'::text, 'completed'::text, 'expired'::text])));
alter table public.decision_records add constraint decision_records_type CHECK ((decision_type = 'today'::text));
alter table public.decision_records add constraint decision_records_uncertainty_object CHECK (((uncertainty IS NULL) OR (jsonb_typeof(uncertainty) = 'object'::text)));
alter table public.decision_records add constraint decision_records_user_override_object CHECK (((user_override IS NULL) OR (jsonb_typeof(user_override) = 'object'::text)));
alter table public.exercises add constraint exercises_muscle_group_known CHECK ((muscle_group = ANY (ARRAY['legs'::text, 'back'::text, 'arms'::text, 'chest'::text, 'shoulders'::text, 'fullbody'::text, 'cardio'::text, 'core'::text, 'glutes'::text, 'abs'::text, 'mobility'::text])));
alter table public.hydration_logs add constraint hydration_logs_amount_ml_check CHECK (((amount_ml > 0) AND (amount_ml <= 3000)));
alter table public.nutrition_logs add constraint nutrition_logs_source_check CHECK (((source IS NULL) OR (source = ANY (ARRAY['text_estimate'::text, 'photo_estimate'::text]))));
alter table public.paddle_webhook_events add constraint paddle_webhook_events_environment_check CHECK ((environment = ANY (ARRAY['sandbox'::text, 'live'::text])));
alter table public.personal_timeline_events add constraint personal_timeline_event_type_format CHECK ((event_type ~ '^[a-z][a-z0-9_]{2,79}$'::text));
alter table public.personal_timeline_events add constraint personal_timeline_provenance CHECK ((provenance = ANY (ARRAY['measured'::text, 'user_reported'::text, 'device_reported'::text, 'calculated'::text, 'inferred'::text, 'predicted'::text, 'simulated'::text])));
alter table public.personal_timeline_events add constraint personal_timeline_quality CHECK ((quality = ANY (ARRAY['unknown'::text, 'low'::text, 'moderate'::text, 'high'::text])));
alter table public.personal_timeline_events add constraint personal_timeline_schema_version_format CHECK ((schema_version ~ '^[1-9][0-9]*[.][0-9]+$'::text));
alter table public.personal_timeline_events add constraint personal_timeline_summary_object CHECK ((jsonb_typeof(summary) = 'object'::text));
alter table public.plans add constraint plans_data_days_match_frequency CHECK (((jsonb_typeof(data) = 'object'::text) AND (jsonb_typeof((data -> 'days'::text)) = 'array'::text) AND (jsonb_array_length((data -> 'days'::text)) = days_per_week)));
alter table public.plans add constraint plans_days_per_week_range CHECK (((days_per_week >= 1) AND (days_per_week <= 7)));
alter table public.plans add constraint plans_weeks_range CHECK (((weeks >= 1) AND (weeks <= 104)));
alter table public.training_rhythms add constraint training_rhythms_weekday_count CHECK (((cardinality(preferred_weekdays) >= 1) AND (cardinality(preferred_weekdays) <= 7)));
alter table public.training_rhythms add constraint training_rhythms_weekday_range CHECK ((preferred_weekdays <@ ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint]));
alter table public.training_rhythms add constraint training_rhythms_weekdays_unique CHECK (training_rhythm_weekdays_are_unique(preferred_weekdays));
alter table public.user_insights add constraint user_insights_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'positive'::text, 'attention'::text, 'critical'::text])));
alter table public.user_insights add constraint user_insights_status_check CHECK ((status = ANY (ARRAY['new'::text, 'seen'::text, 'dismissed'::text, 'resolved'::text])));
alter table public.user_memory add constraint user_memory_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)));
alter table public.user_memory add constraint user_memory_evidence_refs_is_array CHECK ((jsonb_typeof(evidence_refs) = 'array'::text));
alter table public.user_memory add constraint user_memory_importance_check CHECK (((importance >= (0)::numeric) AND (importance <= (1)::numeric)));
alter table public.user_memory add constraint user_memory_memory_type_check CHECK ((memory_type = ANY (ARRAY['preference'::text, 'goal'::text, 'constraint'::text, 'pattern'::text, 'fact'::text, 'coaching'::text, 'nutrition'::text, 'training'::text, 'recovery'::text, 'behavior'::text, 'training_pattern'::text, 'recovery_pattern'::text, 'nutrition_pattern'::text, 'coaching_insight'::text, 'discovery'::text, 'current_context'::text])));
alter table public.user_memory add constraint user_memory_source_check CHECK ((source = ANY (ARRAY['user_reported'::text, 'measured'::text, 'wearable'::text, 'calculated'::text, 'ai_inferred'::text, 'experimental'::text, 'system_generated'::text])));
alter table public.user_memory add constraint user_memory_status_check CHECK ((status = ANY (ARRAY['active'::text, 'superseded'::text, 'expired'::text, 'dismissed'::text, 'corrected'::text, 'incorrect'::text])));
alter table public.user_memory add constraint user_memory_value_is_object CHECK (((value IS NULL) OR (jsonb_typeof(value) = 'object'::text)));
alter table public.workout_sessions add constraint workout_sessions_adaptation_modifier_range CHECK (((adaptation_modifier >= 0.5) AND (adaptation_modifier <= 1.1))) NOT VALID;
alter table public.workout_sessions add constraint workout_sessions_feeling_range CHECK (((feeling IS NULL) OR ((feeling >= 1) AND (feeling <= 5))));
alter table public.workout_sessions add constraint workout_sessions_snapshot_is_object CHECK (((workout_snapshot IS NULL) OR (jsonb_typeof(workout_snapshot) = 'object'::text)));

alter table public.ai_personalization_consents add constraint ai_personalization_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.ai_usage_daily add constraint ai_usage_daily_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.app_observability_events add constraint app_observability_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.athlete_state_snapshots add constraint athlete_state_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.body_metrics add constraint body_metrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.coach_messages add constraint coach_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.daily_checkins add constraint daily_checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.decision_evidence add constraint decision_evidence_decision_id_fkey FOREIGN KEY (decision_id) REFERENCES decision_records(id) ON DELETE CASCADE;
alter table public.decision_outcomes add constraint decision_outcomes_decision_id_fkey FOREIGN KEY (decision_id) REFERENCES decision_records(id) ON DELETE CASCADE;
alter table public.decision_records add constraint decision_records_athlete_state_snapshot_id_fkey FOREIGN KEY (athlete_state_snapshot_id) REFERENCES athlete_state_snapshots(id) ON DELETE CASCADE;
alter table public.decision_records add constraint decision_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.form_analyses add constraint form_analyses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.health_samples add constraint health_samples_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.meal_plans add constraint meal_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.nutrition_logs add constraint nutrition_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.personal_timeline_events add constraint personal_timeline_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.plans add constraint plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.reminders add constraint reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.set_logs add constraint set_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE;
alter table public.set_logs add constraint set_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.subscriptions add constraint subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.supplements add constraint supplements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.training_rhythms add constraint training_rhythms_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_insights add constraint user_insights_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_memory add constraint user_memory_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES user_memory(id) ON DELETE SET NULL;
alter table public.user_memory add constraint user_memory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_roles add constraint user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.vbt_logs add constraint vbt_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.vision_meal_scans add constraint vision_meal_scans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.workout_sessions add constraint workout_sessions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;
alter table public.workout_sessions add constraint workout_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================ indexes

CREATE INDEX ai_personalization_consents_user_recorded_idx ON public.ai_personalization_consents USING btree (user_id, recorded_at DESC, id DESC);
CREATE INDEX ai_usage_daily_date_idx ON public.ai_usage_daily USING btree (usage_date DESC);
CREATE INDEX app_observability_events_failures_created_idx ON public.app_observability_events USING btree (created_at DESC) WHERE (outcome = 'failure'::text);
CREATE INDEX app_observability_events_name_created_idx ON public.app_observability_events USING btree (event_name, created_at DESC);
CREATE INDEX app_observability_events_user_created_idx ON public.app_observability_events USING btree (user_id, created_at DESC);
CREATE INDEX athlete_state_snapshots_user_computed_at_idx ON public.athlete_state_snapshots USING btree (user_id, computed_at DESC);
CREATE UNIQUE INDEX body_metrics_one_per_user_day_idx ON public.body_metrics USING btree (user_id, measured_on);
CREATE INDEX body_metrics_user_idx ON public.body_metrics USING btree (user_id, measured_on DESC);
CREATE INDEX coach_messages_user_created_idx ON public.coach_messages USING btree (user_id, created_at DESC);
CREATE INDEX decision_evidence_decision_position_idx ON public.decision_evidence USING btree (decision_id, "position");
CREATE INDEX decision_records_athlete_state_snapshot_idx ON public.decision_records USING btree (athlete_state_snapshot_id);
CREATE INDEX decision_records_user_decision_on_idx ON public.decision_records USING btree (user_id, decision_on DESC, created_at DESC);
CREATE INDEX form_analyses_user_idx ON public.form_analyses USING btree (user_id, created_at DESC);
CREATE INDEX hydration_logs_user_day_idx ON public.hydration_logs USING btree (user_id, logged_on DESC);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);
CREATE UNIQUE INDEX meal_plans_one_active_per_user_idx ON public.meal_plans USING btree (user_id) WHERE (is_active = true);
CREATE INDEX meal_plans_user_idx ON public.meal_plans USING btree (user_id, created_at DESC);
CREATE INDEX nutrition_logs_user_day_idx ON public.nutrition_logs USING btree (user_id, logged_on DESC);
CREATE UNIQUE INDEX personal_timeline_source_event_unique ON public.personal_timeline_events USING btree (user_id, source_system, source_reference, event_type) WHERE (source_reference IS NOT NULL);
CREATE INDEX personal_timeline_user_occurred_idx ON public.personal_timeline_events USING btree (user_id, occurred_at DESC);
CREATE UNIQUE INDEX plans_one_active_per_user_idx ON public.plans USING btree (user_id) WHERE (is_active = true);
CREATE INDEX plans_user_idx ON public.plans USING btree (user_id, created_at DESC);
CREATE INDEX sessions_user_idx ON public.workout_sessions USING btree (user_id, started_at DESC);
CREATE UNIQUE INDEX set_logs_session_exercise_set_unique ON public.set_logs USING btree (session_id, exercise_slug, set_number);
CREATE INDEX set_logs_session_idx ON public.set_logs USING btree (session_id);
CREATE INDEX set_logs_user_ex_idx ON public.set_logs USING btree (user_id, exercise_slug, created_at DESC);
CREATE INDEX set_logs_user_performed_idx ON public.set_logs USING btree (user_id, performed_at DESC);
CREATE INDEX supplements_user_idx ON public.supplements USING btree (user_id, updated_at DESC);
CREATE INDEX user_insights_user_status_created_idx ON public.user_insights USING btree (user_id, status, created_at DESC);
CREATE INDEX user_memory_active_context_idx ON public.user_memory USING btree (user_id, expires_at, updated_at DESC) WHERE ((memory_type = 'current_context'::text) AND (status = 'active'::text));
CREATE UNIQUE INDEX user_memory_active_memory_key_unique ON public.user_memory USING btree (user_id, memory_key) WHERE ((memory_key IS NOT NULL) AND (status = 'active'::text));
CREATE INDEX user_memory_superseded_by_idx ON public.user_memory USING btree (superseded_by) WHERE (superseded_by IS NOT NULL);
CREATE INDEX user_memory_user_importance_idx ON public.user_memory USING btree (user_id, importance DESC);
CREATE INDEX user_memory_user_status_idx ON public.user_memory USING btree (user_id, status);
CREATE INDEX user_memory_user_type_idx ON public.user_memory USING btree (user_id, memory_type);
CREATE INDEX vbt_logs_user_idx ON public.vbt_logs USING btree (user_id, created_at DESC);
CREATE INDEX vision_meal_scans_user_idx ON public.vision_meal_scans USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX workout_sessions_one_open_plan_day ON public.workout_sessions USING btree (user_id, plan_id, day_index) WHERE ((finished_at IS NULL) AND (plan_id IS NOT NULL) AND (day_index IS NOT NULL));
CREATE INDEX workout_sessions_plan_idx ON public.workout_sessions USING btree (plan_id, started_at DESC);
CREATE INDEX workout_sessions_user_plan_finished_idx ON public.workout_sessions USING btree (user_id, plan_id, finished_at DESC) WHERE ((finished_at IS NOT NULL) AND (plan_id IS NOT NULL));
CREATE INDEX workout_sessions_user_plan_open_started_idx ON public.workout_sessions USING btree (user_id, plan_id, started_at DESC) WHERE ((finished_at IS NULL) AND (plan_id IS NOT NULL));

-- ============================================================ triggers

CREATE TRIGGER daily_checkins_updated BEFORE UPDATE ON public.daily_checkins FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER health_samples_updated_at BEFORE UPDATE ON public.health_samples FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER meal_plans_updated_at BEFORE UPDATE ON public.meal_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER update_supplements_updated_at BEFORE UPDATE ON public.supplements FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER workout_sessions_snapshot_immutable BEFORE UPDATE ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION prevent_workout_snapshot_mutation();

-- New profile rows follow new auth users. This lives on auth.users, so it is
-- listed apart from the public triggers above.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================ row level security

alter table public.ai_personalization_consents enable row level security;
alter table public.ai_usage_daily enable row level security;
alter table public.app_observability_events enable row level security;
alter table public.athlete_state_snapshots enable row level security;
alter table public.body_metrics enable row level security;
alter table public.coach_messages enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.decision_evidence enable row level security;
alter table public.decision_outcomes enable row level security;
alter table public.decision_records enable row level security;
alter table public.exercises enable row level security;
alter table public.form_analyses enable row level security;
alter table public.health_samples enable row level security;
alter table public.hydration_logs enable row level security;
alter table public.meal_plans enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.paddle_webhook_events enable row level security;
alter table public.personal_timeline_events enable row level security;
alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.reminders enable row level security;
alter table public.set_logs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.supplements enable row level security;
alter table public.training_rhythms enable row level security;
alter table public.user_insights enable row level security;
alter table public.user_memory enable row level security;
alter table public.user_roles enable row level security;
alter table public.vbt_logs enable row level security;
alter table public.vision_meal_scans enable row level security;
alter table public.workout_sessions enable row level security;

-- ============================================================ policies
--
-- app_observability_events and paddle_webhook_events deliberately have RLS
-- enabled and no policies at all: deny-all to every client role, written and
-- read only through the service role.

create policy "Users read own AI personalization consent history" on public.ai_personalization_consents as permissive for select to authenticated using (((select auth.uid() as uid) = user_id));
create policy "Users record own AI personalization consent" on public.ai_personalization_consents as permissive for insert to authenticated with check (((select auth.uid() as uid) = user_id));
create policy "Users read own ai usage" on public.ai_usage_daily as permissive for select to authenticated using (((select auth.uid() as uid) = user_id));
create policy "Users can read their own athlete state history" on public.athlete_state_snapshots as permissive for select to authenticated using (((select auth.uid() as uid) = user_id));
create policy "own metrics" on public.body_metrics as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "Users manage their own coach messages" on public.coach_messages as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "own checkins" on public.daily_checkins as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "Users can read evidence for their own decisions" on public.decision_evidence as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM decision_records
  WHERE ((decision_records.id = decision_evidence.decision_id) AND (decision_records.user_id = ( SELECT auth.uid() AS uid))))));
create policy "Users can read outcomes for their own decisions" on public.decision_outcomes as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM decision_records
  WHERE ((decision_records.id = decision_outcomes.decision_id) AND (decision_records.user_id = ( SELECT auth.uid() AS uid))))));
create policy "Users can read their own decision records" on public.decision_records as permissive for select to authenticated using (((select auth.uid() as uid) = user_id));
create policy "exercises readable" on public.exercises as permissive for select to anon, authenticated using (true);
create policy "own form analyses" on public.form_analyses as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "own health samples" on public.health_samples as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "Users manage own hydration logs" on public.hydration_logs as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "own meal plans" on public.meal_plans as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "Users manage own nutrition logs" on public.nutrition_logs as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "personal_timeline_select_own" on public.personal_timeline_events as permissive for select to authenticated using (((select auth.uid() as uid) = user_id));
create policy "own plans" on public.plans as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "own profile" on public.profiles as permissive for all to authenticated using (((select auth.uid() as uid) = id)) with check (((select auth.uid() as uid) = id));
create policy "Users manage own reminders" on public.reminders as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "own sets" on public.set_logs as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "Service role can manage subscriptions" on public.subscriptions as permissive for all to service_role using (true) with check (true);
create policy "Users can view own subscription" on public.subscriptions as permissive for select to authenticated using (((select auth.uid() as uid) = user_id));
create policy "own supplements" on public.supplements as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "Users can read their own training rhythm" on public.training_rhythms as permissive for select to authenticated using (((select auth.uid() as uid) = user_id));
create policy "user_insights_select_own" on public.user_insights as permissive for select to authenticated using (((select auth.uid() as uid) = user_id));
create policy "Users delete own memory" on public.user_memory as permissive for delete to authenticated using (((select auth.uid() as uid) = user_id));
create policy "Users read own memory" on public.user_memory as permissive for select to authenticated using (((select auth.uid() as uid) = user_id));
create policy "Users read own roles" on public.user_roles as permissive for select to authenticated using (((select auth.uid() as uid) = user_id));
create policy "own vbt logs" on public.vbt_logs as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "own vision meal scans" on public.vision_meal_scans as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "own sessions" on public.workout_sessions as permissive for all to authenticated using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));

-- ============================================================ grants
--
-- Table privileges are only the outer gate; RLS decides the rows. Tables
-- where authenticated holds no privileges at all (app_observability_events,
-- paddle_webhook_events) are reachable by the service role alone.

grant select on public.ai_personalization_consents to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.ai_personalization_consents to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.ai_usage_daily to anon;
grant delete, insert, references, select, trigger, truncate, update on public.ai_usage_daily to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.ai_usage_daily to service_role;
grant insert, select on public.app_observability_events to service_role;
grant select on public.athlete_state_snapshots to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.athlete_state_snapshots to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.body_metrics to anon;
grant delete, insert, references, select, trigger, truncate, update on public.body_metrics to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.body_metrics to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.coach_messages to anon;
grant delete, insert, references, select, trigger, truncate, update on public.coach_messages to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.coach_messages to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.daily_checkins to anon;
grant delete, insert, references, select, trigger, truncate, update on public.daily_checkins to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.daily_checkins to service_role;
grant select on public.decision_evidence to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.decision_evidence to service_role;
grant select on public.decision_outcomes to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.decision_outcomes to service_role;
grant select on public.decision_records to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.decision_records to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.exercises to anon;
grant delete, insert, references, select, trigger, truncate, update on public.exercises to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.exercises to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.form_analyses to anon;
grant delete, insert, references, select, trigger, truncate, update on public.form_analyses to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.form_analyses to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.health_samples to anon;
grant delete, insert, references, select, trigger, truncate, update on public.health_samples to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.health_samples to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.hydration_logs to anon;
grant delete, insert, references, select, trigger, truncate, update on public.hydration_logs to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.hydration_logs to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.meal_plans to anon;
grant delete, insert, references, select, trigger, truncate, update on public.meal_plans to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.meal_plans to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.nutrition_logs to anon;
grant delete, insert, references, select, trigger, truncate, update on public.nutrition_logs to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.nutrition_logs to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.paddle_webhook_events to service_role;
grant select on public.personal_timeline_events to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.personal_timeline_events to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.plans to anon;
grant delete, insert, references, select, trigger, truncate, update on public.plans to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.plans to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.profiles to anon;
grant delete, insert, references, select, trigger, truncate, update on public.profiles to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.profiles to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.reminders to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.reminders to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.set_logs to anon;
grant delete, insert, references, select, trigger, truncate, update on public.set_logs to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.set_logs to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.subscriptions to anon;
grant delete, insert, references, select, trigger, truncate, update on public.subscriptions to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.subscriptions to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.supplements to anon;
grant delete, insert, references, select, trigger, truncate, update on public.supplements to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.supplements to service_role;
grant select on public.training_rhythms to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.training_rhythms to service_role;
grant select on public.user_insights to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.user_insights to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.user_memory to anon;
grant delete, insert, references, select, trigger, truncate, update on public.user_memory to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.user_memory to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.user_roles to anon;
grant delete, insert, references, select, trigger, truncate, update on public.user_roles to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.user_roles to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.vbt_logs to anon;
grant delete, insert, references, select, trigger, truncate, update on public.vbt_logs to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.vbt_logs to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.vision_meal_scans to anon;
grant delete, insert, references, select, trigger, truncate, update on public.vision_meal_scans to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.vision_meal_scans to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.workout_sessions to anon;
grant delete, insert, references, select, trigger, truncate, update on public.workout_sessions to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.workout_sessions to service_role;

-- A fresh Supabase project's default privileges hand anon and authenticated
-- everything on every new table, and service_role everything too. The grants
-- above are what production actually has, so the wider defaults are stripped
-- back first — otherwise a rebuilt database is quietly more permissive than
-- the one it is supposed to reproduce.
revoke all on public.ai_personalization_consents from anon, authenticated;
revoke all on public.app_observability_events from anon, authenticated, service_role;
revoke all on public.athlete_state_snapshots from anon, authenticated;
revoke all on public.decision_evidence from anon, authenticated;
revoke all on public.decision_outcomes from anon, authenticated;
revoke all on public.decision_records from anon, authenticated;
revoke all on public.paddle_webhook_events from anon, authenticated;
revoke all on public.personal_timeline_events from anon, authenticated;
revoke all on public.reminders from anon, authenticated;
revoke all on public.training_rhythms from anon, authenticated;
revoke all on public.user_insights from anon, authenticated;

-- Re-grant exactly what production holds, including the observability ledger,
-- which is append-and-read only even for the service role: nothing in the app
-- updates, deletes or truncates a recorded event.
grant select on public.ai_personalization_consents to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.ai_personalization_consents to service_role;
grant insert, select on public.app_observability_events to service_role;
grant select on public.athlete_state_snapshots to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.athlete_state_snapshots to service_role;
grant select on public.decision_evidence to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.decision_evidence to service_role;
grant select on public.decision_outcomes to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.decision_outcomes to service_role;
grant select on public.decision_records to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.decision_records to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.paddle_webhook_events to service_role;
grant select on public.personal_timeline_events to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.personal_timeline_events to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.reminders to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.reminders to service_role;
grant select on public.training_rhythms to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.training_rhythms to service_role;
grant select on public.user_insights to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.user_insights to service_role;

-- The consent ledger is append-only for the athlete: they may add a row and
-- read their history, but never edit or delete what they previously agreed to.
grant insert (user_id, granted, policy_version) on public.ai_personalization_consents to authenticated;

-- The health sync token is a bearer credential for the ingest endpoint, so it
-- is hidden from every client-reachable role at column level.
revoke select (health_token) on public.profiles from anon, authenticated;
revoke update (health_token) on public.profiles from anon, authenticated;

-- SECURITY DEFINER functions must not be callable straight from the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.has_active_subscription(uuid, text) from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.consume_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.has_active_subscription(uuid, text) to service_role;
grant execute on function public.has_role(uuid, public.app_role) to service_role;
grant execute on function public.consume_ai_quota(uuid, integer) to service_role;

-- ============================================================ comments

comment on table public.app_observability_events is 'Private server observability. RLS has no client policies intentionally; writes/reads are server-side only.';
comment on table public.athlete_state_snapshots is 'Validated, versioned Digital Athlete aggregates. Source facts remain in their domain tables.';
comment on table public.decision_evidence is 'Short, typed facts supporting a Today decision. It never stores AI-generated rationale.';
comment on table public.decision_outcomes is 'One explicit athlete outcome for a Today decision; aggregated only after sufficient evidence to calibrate future confidence labels.';
comment on table public.decision_records is 'Server-owned Decision Ledger. Records the selected action and its auditable snapshot, evidence, safety, uncertainty and model context.';
comment on table public.hydration_logs is 'Individual fluid intake entries. One row per drink logged, in the athlete''s local calendar day.';
comment on table public.paddle_webhook_events is 'Private Paddle webhook idempotency ledger. RLS has no client policies intentionally; server-side only.';
comment on table public.personal_timeline_events is 'Canonical Future Lab timeline index. References normalized personal events without replacing source-of-truth domain records.';
comment on table public.training_rhythms is 'Optional, user-reported usual training days for Today decisions; never a hard workout schedule.';
comment on table public.user_insights is 'Server-maintained personal intelligence. Authenticated users may read only their own rows; client mutation is intentionally denied.';

comment on column public.athlete_state_snapshots.calculation_version is 'Version of deterministic/derived logic used to compute this state snapshot; distinct from schema_version.';
comment on column public.athlete_state_snapshots.provenance_summary is 'Compact provenance metadata for the state; raw source facts remain in canonical domain tables.';
comment on column public.athlete_state_snapshots.uncertainty_summary is 'Structured uncertainty metadata. Empty means legacy/not-yet-populated, never certainty.';
comment on column public.decision_records.confidence is 'Deprecated legacy numerical value. New Today decisions use decision_basis instead of a percentage.';
comment on column public.decision_records.decision_basis is 'Explainable non-probabilistic basis for deterministic Today decision engine v1.9+.';
comment on column public.nutrition_logs.source is 'How the macros were produced: text_estimate (model, from a description), photo_estimate (vision model, from an image). Null for rows written before provenance was recorded.';
comment on column public.personal_timeline_events.provenance is 'Origin semantics only: measured, user_reported, device_reported, calculated, inferred, predicted, or simulated. Unknown/known belong to evidence state, not provenance.';
comment on column public.profiles.time_zone is 'Validated IANA time zone used for user-local calendar-day boundaries. Server code falls back to UTC only for invalid legacy values.';
comment on column public.set_logs.performed_at is 'When the set was actually performed, as reported by the client and bounded server-side. Use this for anything time-based; created_at is the row write time.';
comment on column public.user_memory.evidence_refs is 'Validated references to the facts that support an inference or context.';
comment on column public.user_memory.memory_key is 'Stable application-owned key for typed memory and short-lived life context.';
comment on column public.user_memory.superseded_by is 'Replacement memory record when an active fact or context has changed.';
comment on column public.user_memory.value is 'Validated structured value; human-readable content remains a user-facing summary.';
comment on column public.workout_sessions.feeling is 'Optional user-reported post-workout feeling from 1 (very difficult) to 5 (very good).';
comment on column public.workout_sessions.workout_snapshot is 'Validated, immutable execution plan and deterministic adaptation provenance captured at workout start.';
