-- Replace an active memory with a user-authored correction without losing the
-- historical claim. This is callable only through the trusted app server.
create or replace function public.correct_user_memory(
  p_user_id uuid,
  p_memory_id uuid,
  p_content text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
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
$$;

revoke all on function public.correct_user_memory(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.correct_user_memory(uuid, uuid, text)
  to service_role;
