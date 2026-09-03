-- Training rhythm remains a soft user preference. This function only stores a
-- bounded observation of completed workout days; it never creates a missed-
-- workout record or turns a preference into a required calendar.
create or replace function public.reconcile_calculated_user_memory(
  p_user_id uuid,
  p_entries jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
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
$$;

revoke all on function public.reconcile_calculated_user_memory(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.reconcile_calculated_user_memory(uuid, jsonb)
  to service_role;
