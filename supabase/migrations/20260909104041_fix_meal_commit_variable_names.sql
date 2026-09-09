-- Correct the initial routine variable qualification; behavior verified in a rolled-back staging transaction.
-- Commit the verified plan, its preferences and activation together.
-- This changes no existing user row until the user explicitly generates a plan.
create or replace function public.commit_generated_meal_plan(
  p_plan_id uuid, p_profile_updated_at timestamptz,
  p_plan jsonb, p_preferences jsonb, p_lang text
) returns table(plan_id uuid, created_at timestamptz, updated_at timestamptz)
language plpgsql security invoker set search_path='' as $$
declare
  uid uuid := auth.uid(); revision timestamptz; v_goal text;
  v_diet text; v_allergies text; v_dislikes text; v_meals integer; key text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_plan_id is null or p_profile_updated_at is null or not isfinite(p_profile_updated_at)
    or p_lang is null or p_lang not in ('lt','en','ru','uk','pl','de','es','fr')
    or jsonb_typeof(p_plan) is distinct from 'object'
    or jsonb_typeof(p_preferences) is distinct from 'object'
  then raise exception 'MEAL_COMMIT_INVALID_INPUT'; end if;
  v_diet:=p_preferences->>'diet'; v_allergies:=p_preferences->>'allergies'; v_dislikes:=p_preferences->>'dislikes';
  v_meals:=(p_preferences->>'mealsPerDay')::integer;
  if v_diet is null or v_diet not in ('any','vegetarian','vegan','pescatarian','low carb','gluten free','lactose free')
    or v_allergies is null or length(v_allergies)>500 or v_dislikes is null or length(v_dislikes)>500
    or v_meals is null or v_meals<2 or v_meals>6
    or nullif(btrim(p_plan->>'title'),'') is null
    or jsonb_typeof(p_plan->'days') is distinct from 'array'
  then raise exception 'MEAL_COMMIT_INVALID_PLAN'; end if;
  foreach key in array array['kcal_target','protein_target','carbs_target','fat_target'] loop
    if jsonb_typeof(p_plan->key) is distinct from 'number' or (p_plan->>key)::numeric<0
    then raise exception 'MEAL_COMMIT_INVALID_TARGET'; end if;
  end loop;
  if (p_plan->>'kcal_target')::numeric<1000 or (p_plan->>'kcal_target')::numeric>6000
    or jsonb_array_length(p_plan->'days')<>7
    or (select count(distinct (day->>'day')::integer) from jsonb_array_elements(p_plan->'days') day)<>7
    or exists(select 1 from jsonb_array_elements(p_plan->'days') day
      where (day->>'day') is null or (day->>'day')::integer not between 1 and 7
      or jsonb_typeof(day->'meals') is distinct from 'array' or jsonb_array_length(day->'meals')<>v_meals)
  then raise exception 'MEAL_COMMIT_INVALID_DAYS'; end if;
  -- Same user-level lock as activate_meal_plan, before taking any row lock.
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select p.updated_at,p.goal into revision,v_goal from public.profiles p where p.id=uid for update;
  if not found then raise exception 'MEAL_PROFILE_INCOMPLETE'; end if;
  if revision is distinct from p_profile_updated_at then raise exception 'MEAL_PROFILE_CHANGED'; end if;
  update public.profiles p set diet=v_diet,
    allergies=v_allergies,dislikes=v_dislikes,
    meals_per_day=v_meals where p.id=uid;
  insert into public.meal_plans(id,user_id,title,goal,diet,allergies,dislikes,
    kcal_target,protein_target,carbs_target,fat_target,is_active,lang,i18n,data)
  values(p_plan_id,uid,p_plan->>'title',v_goal,v_diet,v_allergies,v_dislikes,
    (p_plan->>'kcal_target')::numeric,(p_plan->>'protein_target')::numeric,
    (p_plan->>'carbs_target')::numeric,(p_plan->>'fat_target')::numeric,false,p_lang,'{}',p_plan);
  perform public.activate_meal_plan(p_plan_id);
  return query select m.id,m.created_at,m.updated_at from public.meal_plans m
    where m.id=p_plan_id and m.user_id=uid and m.is_active;
end $$;
