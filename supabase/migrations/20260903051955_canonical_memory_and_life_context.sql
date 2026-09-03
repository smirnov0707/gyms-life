-- Evolve the existing app-owned memory ledger instead of introducing a
-- parallel context system. Current-life context is a short-lived, typed memory
-- record with explicit provenance and expiry.

alter table public.user_memory
  add column if not exists memory_key text,
  add column if not exists value jsonb,
  add column if not exists evidence_refs jsonb not null default '[]'::jsonb,
  add column if not exists superseded_by uuid;

update public.user_memory
set source = case source
  when 'user' then 'user_reported'
  when 'conversation' then 'user_reported'
  when 'behavior' then 'calculated'
  when 'insight' then 'ai_inferred'
  when 'system' then 'system_generated'
  else source
end
where source in ('user', 'conversation', 'behavior', 'insight', 'system');

alter table public.user_memory
  drop constraint if exists user_memory_memory_type_check,
  drop constraint if exists user_memory_source_check,
  drop constraint if exists user_memory_status_check;

alter table public.user_memory
  add constraint user_memory_memory_type_check
    check (memory_type in (
      'preference', 'goal', 'constraint', 'pattern', 'fact', 'coaching',
      'nutrition', 'training', 'recovery', 'behavior', 'training_pattern',
      'recovery_pattern', 'nutrition_pattern', 'coaching_insight',
      'discovery', 'current_context'
    )) not valid,
  add constraint user_memory_source_check
    check (source in (
      'user_reported', 'measured', 'wearable', 'calculated', 'ai_inferred',
      'experimental', 'system_generated'
    )) not valid,
  add constraint user_memory_status_check
    check (status in (
      'active', 'superseded', 'expired', 'dismissed', 'corrected', 'incorrect'
    )) not valid,
  add constraint user_memory_value_is_object
    check (value is null or jsonb_typeof(value) = 'object') not valid,
  add constraint user_memory_evidence_refs_is_array
    check (jsonb_typeof(evidence_refs) = 'array') not valid,
  add constraint user_memory_superseded_by_fkey
    foreign key (superseded_by) references public.user_memory (id) on delete set null not valid;

alter table public.user_memory
  validate constraint user_memory_memory_type_check,
  validate constraint user_memory_source_check,
  validate constraint user_memory_status_check,
  validate constraint user_memory_value_is_object,
  validate constraint user_memory_evidence_refs_is_array,
  validate constraint user_memory_superseded_by_fkey;

create index if not exists user_memory_active_context_idx
  on public.user_memory (user_id, expires_at asc, updated_at desc)
  where memory_type = 'current_context' and status = 'active';

comment on column public.user_memory.memory_key is
  'Stable application-owned key for typed memory and short-lived life context.';
comment on column public.user_memory.value is
  'Validated structured value; human-readable content remains a user-facing summary.';
comment on column public.user_memory.evidence_refs is
  'Validated references to the facts that support an inference or context.';
comment on column public.user_memory.superseded_by is
  'Replacement memory record when an active fact or context has changed.';

-- The app server is the only caller. A single RPC keeps replacing a temporary
-- context atomic while retaining the superseded record for transparency.
create or replace function public.replace_active_life_context(
  p_user_id uuid,
  p_memory_key text,
  p_content text,
  p_value jsonb,
  p_importance numeric,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
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
$$;

revoke all on function public.replace_active_life_context(uuid, text, text, jsonb, numeric, timestamptz)
  from public, anon, authenticated;
grant execute on function public.replace_active_life_context(uuid, text, text, jsonb, numeric, timestamptz)
  to service_role;

alter table public.decision_records
  drop constraint if exists decision_records_safety_constraints_valid;

alter table public.decision_records
  add constraint decision_records_safety_constraints_valid
    check (safety_constraints <@ array[
      'requires_active_plan_before_training',
      'do_not_adapt_load_without_today_checkin',
      'avoid_progression_when_readiness_low',
      'apply_persisted_readiness_modifier',
      'avoid_duplicate_training_prompt',
      'avoid_training_with_active_limitation'
    ]::text[]) not valid;

alter table public.decision_records
  validate constraint decision_records_safety_constraints_valid;

alter table public.decision_evidence
  drop constraint if exists decision_evidence_key;

alter table public.decision_evidence
  add constraint decision_evidence_key
    check (evidence_key in (
      'active_training_plan', 'today_readiness', 'completed_workout_today',
      'sessions_last_7_days', 'load_modifier', 'model_data_quality',
      'active_life_context'
    )) not valid;

alter table public.decision_evidence
  validate constraint decision_evidence_key;
