-- The quota RPC is deliberately server-only. The Netlify server calls it using
-- the service-role key, which does not carry an end-user auth.uid() claim.
-- Authorize that server role explicitly and keep direct browser execution
-- revoked so callers cannot select a user or quota limit themselves.
create or replace function public.consume_ai_quota(p_user_id uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.consume_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer) to service_role;
