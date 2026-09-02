-- A member can have exactly one active meal plan. Normalize any historical
-- duplicates before enforcing that invariant at the database boundary.
with ranked_active_plans as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at desc, id desc
    ) as active_rank
  from public.meal_plans
  where is_active = true
)
update public.meal_plans as meal_plan
set is_active = false
from ranked_active_plans
where meal_plan.id = ranked_active_plans.id
  and ranked_active_plans.active_rank > 1;

create unique index if not exists meal_plans_one_active_per_user_idx
  on public.meal_plans (user_id)
  where is_active = true;

create or replace function public.activate_meal_plan(p_meal_plan_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  selected_meal_plan_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to activate a meal plan';
  end if;

  -- Serialize activation requests only within this member's account.
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
$$;

revoke all on function public.activate_meal_plan(uuid) from public, anon;
grant execute on function public.activate_meal_plan(uuid) to authenticated, service_role;
