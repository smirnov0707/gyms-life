-- Plan activation is one state transition: a user must never observe an
-- account with no active plan, nor end up with two active plans after
-- concurrent requests from multiple devices.
create or replace function public.activate_training_plan(p_plan_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  selected_plan_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to activate a training plan';
  end if;

  -- Serialize activation requests for a user without locking other accounts.
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
$$;

revoke all on function public.activate_training_plan(uuid) from public, anon;
grant execute on function public.activate_training_plan(uuid) to authenticated, service_role;
