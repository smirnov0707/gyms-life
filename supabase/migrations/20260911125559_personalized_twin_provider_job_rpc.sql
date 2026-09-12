create or replace function public.claim_personalized_twin_provider_submission(
  p_user_id uuid,
  p_capture_set_id uuid,
  p_provider_key text,
  p_claim_token text,
  p_claim_until timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.personalized_twin_capture_sets%rowtype;
begin
  select * into v_row
  from public.personalized_twin_capture_sets
  where id = p_capture_set_id and user_id = p_user_id
  for update;

  if not found then raise exception 'PERSONALIZED_TWIN_CAPTURE_SET_NOT_FOUND'; end if;
  if v_row.provider_job_id is not null then
    if v_row.provider_key is distinct from p_provider_key then
      raise exception 'PERSONALIZED_TWIN_PROVIDER_KEY_MISMATCH';
    end if;
    return jsonb_build_object('state','existing','providerJobId',v_row.provider_job_id);
  end if;
  if v_row.status <> 'ready_for_provider' then
    raise exception 'PERSONALIZED_TWIN_INVALID_SUBMISSION_STATE';
  end if;
  if v_row.provider_submit_claim_until is not null
     and v_row.provider_submit_claim_until > now()
     and v_row.provider_submit_claim_token is distinct from p_claim_token then
    return jsonb_build_object('state','busy');
  end if;

  update public.personalized_twin_capture_sets
  set provider_submit_claim_token = p_claim_token,
      provider_submit_claim_until = p_claim_until,
      provider_key = p_provider_key,
      updated_at = now()
  where id = p_capture_set_id and user_id = p_user_id;

  return jsonb_build_object('state','claimed');
end;
$$;

create or replace function public.release_personalized_twin_provider_submission(
  p_user_id uuid, p_capture_set_id uuid, p_claim_token text
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.personalized_twin_capture_sets
  set provider_submit_claim_token = null,
      provider_submit_claim_until = null,
      updated_at = now()
  where id = p_capture_set_id
    and user_id = p_user_id
    and provider_submit_claim_token = p_claim_token
    and provider_job_id is null;
$$;

create or replace function public.complete_personalized_twin_provider_submission(
  p_user_id uuid,
  p_capture_set_id uuid,
  p_provider_key text,
  p_provider_job_id text,
  p_claim_token text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.personalized_twin_capture_sets
  set status = 'processing',
      provider_key = p_provider_key,
      provider_job_id = p_provider_job_id,
      provider_submit_claim_token = null,
      provider_submit_claim_until = null,
      provider_poll_attempt = 0,
      provider_next_poll_at = now(),
      updated_at = now()
  where id = p_capture_set_id
    and user_id = p_user_id
    and status = 'ready_for_provider'
    and provider_key = p_provider_key
    and provider_submit_claim_token = p_claim_token
    and provider_job_id is null;

  if not found then raise exception 'PERSONALIZED_TWIN_SUBMISSION_CLAIM_LOST'; end if;
end;
$$;

create or replace function public.schedule_personalized_twin_provider_poll(
  p_capture_set_id uuid,
  p_provider_job_id text,
  p_poll_attempt integer,
  p_next_poll_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.personalized_twin_capture_sets
  set provider_poll_attempt = p_poll_attempt,
      provider_next_poll_at = p_next_poll_at,
      updated_at = now()
  where id = p_capture_set_id
    and status = 'processing'
    and provider_job_id = p_provider_job_id;
  if not found then raise exception 'PERSONALIZED_TWIN_PROVIDER_JOB_NOT_PROCESSING'; end if;
end;
$$;
create or replace function public.acquire_personalized_twin_provider_terminal_lease(
  p_capture_set_id uuid,
  p_provider_job_id text,
  p_lease_until timestamptz
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_lease_until timestamptz;
begin
  select status, provider_terminal_lease_until
    into v_status, v_lease_until
  from public.personalized_twin_capture_sets
  where id = p_capture_set_id and provider_job_id = p_provider_job_id
  for update;

  if not found then raise exception 'PERSONALIZED_TWIN_PROVIDER_JOB_NOT_FOUND'; end if;
  if v_status in ('ready','failed') then return 'already_terminal'; end if;
  if v_status <> 'processing' then raise exception 'PERSONALIZED_TWIN_PROVIDER_JOB_NOT_PROCESSING'; end if;
  if v_lease_until is not null and v_lease_until > now() then return 'busy'; end if;

  update public.personalized_twin_capture_sets
  set provider_terminal_lease_until = p_lease_until, updated_at = now()
  where id = p_capture_set_id and provider_job_id = p_provider_job_id;
  return 'acquired';
end;
$$;
create or replace function public.release_personalized_twin_provider_terminal_lease(
  p_capture_set_id uuid, p_provider_job_id text
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.personalized_twin_capture_sets
  set provider_terminal_lease_until = null, updated_at = now()
  where id = p_capture_set_id
    and provider_job_id = p_provider_job_id
    and status = 'processing';
$$;

create or replace function public.claim_personalized_twin_provider_event(
  p_provider_key text,
  p_provider_job_id text,
  p_event_key text
) returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_capture_set_id uuid;
begin
  select id into v_capture_set_id
  from public.personalized_twin_capture_sets
  where provider_key = p_provider_key and provider_job_id = p_provider_job_id;
  if not found then raise exception 'PERSONALIZED_TWIN_PROVIDER_JOB_NOT_FOUND'; end if;

  insert into private.personalized_twin_provider_events(provider_key, provider_job_id, event_key, capture_set_id)
  values (p_provider_key, p_provider_job_id, p_event_key, v_capture_set_id)
  on conflict do nothing;
  if found then return 'claimed'; end if;
  return 'duplicate';
end;
$$;

revoke all on function public.claim_personalized_twin_provider_submission(uuid,uuid,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.release_personalized_twin_provider_submission(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.complete_personalized_twin_provider_submission(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.schedule_personalized_twin_provider_poll(uuid,text,integer,timestamptz) from public, anon, authenticated;
revoke all on function public.acquire_personalized_twin_provider_terminal_lease(uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.release_personalized_twin_provider_terminal_lease(uuid,text) from public, anon, authenticated;
revoke all on function public.claim_personalized_twin_provider_event(text,text,text) from public, anon, authenticated;

grant execute on function public.claim_personalized_twin_provider_submission(uuid,uuid,text,text,timestamptz) to service_role;
grant execute on function public.release_personalized_twin_provider_submission(uuid,uuid,text) to service_role;
grant execute on function public.complete_personalized_twin_provider_submission(uuid,uuid,text,text,text) to service_role;
grant execute on function public.schedule_personalized_twin_provider_poll(uuid,text,integer,timestamptz) to service_role;
grant execute on function public.acquire_personalized_twin_provider_terminal_lease(uuid,text,timestamptz) to service_role;
grant execute on function public.release_personalized_twin_provider_terminal_lease(uuid,text) to service_role;
grant execute on function public.claim_personalized_twin_provider_event(text,text,text) to service_role;
