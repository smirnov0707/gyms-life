-- STAGING ONLY. Synthetic rows, deliberately rolled back. No AI/provider calls.
begin;
select set_config('gyms.plan_audit_user',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('gyms.plan_audit_user')::uuid,current_setting('gyms.plan_audit_user')||'@example.invalid');
select set_config('request.jwt.claim.sub',current_setting('gyms.plan_audit_user'),true);
set local role authenticated;
do $$
declare payload jsonb;prefs jsonb;rev timestamptz;first_plan uuid:=gen_random_uuid();next_plan uuid:=gen_random_uuid();saved record;old_diet text;failed boolean;
begin
 select updated_at into rev from public.profiles where id=auth.uid();
 -- These minimal synthetic recipes test transaction semantics, not recipe validation.
 select jsonb_build_object('title','Synthetic seven-day test','kcal_target',2000,'protein_target',100,'carbs_target',250,'fat_target',66,
   'days',jsonb_agg(jsonb_build_object('day',d,'meals',jsonb_build_array('{}'::jsonb,'{}'::jsonb)))) into payload from generate_series(1,7) d;
 prefs:='{"diet":"vegan","allergies":"peanuts","dislikes":"mushrooms","mealsPerDay":2}'::jsonb;
 select * into saved from public.commit_generated_meal_plan(first_plan,rev,payload,prefs,'en');
 if saved.plan_id<>first_plan or saved.updated_at is null or saved.created_at is null
   or not exists(select 1 from public.meal_plans where id=first_plan and is_active)
   or (select diet from public.profiles where id=auth.uid())<>'vegan' then raise exception 'Atomic initial save failed';end if;
 select updated_at,diet into rev,old_diet from public.profiles where id=auth.uid();
 failed:=false;
 begin perform public.commit_generated_meal_plan(next_plan,rev-interval '1 second',payload,prefs||'{"diet":"any"}'::jsonb,'en');
 exception when raise_exception then failed:=SQLERRM='MEAL_PROFILE_CHANGED';end;
 if not failed or exists(select 1 from public.meal_plans where id=next_plan)
   or (select diet from public.profiles where id=auth.uid())<>old_diet then raise exception 'Stale profile check failed';end if;
 failed:=false;
 begin perform public.commit_generated_meal_plan(first_plan,rev,payload,prefs||'{"diet":"any"}'::jsonb,'en');
 exception when unique_violation then failed:=true;end;
 if not failed or (select diet from public.profiles where id=auth.uid())<>old_diet
   or not (select is_active from public.meal_plans where id=first_plan) then raise exception 'Failed insert did not roll back preferences';end if;
 select * into saved from public.commit_generated_meal_plan(next_plan,rev,payload,prefs||'{"diet":"any"}'::jsonb,'en');
 if saved.plan_id<>next_plan or (select count(*) from public.meal_plans where user_id=auth.uid() and is_active)<>1
   or (select is_active from public.meal_plans where id=first_plan)
   or not exists(select 1 from public.meal_plans where id=first_plan) then raise exception 'Replacement lost previous plan or activation';end if;
 perform set_config('gyms.meal_commit_checks','passed',true);
end $$;
select jsonb_build_object('scope','synthetic staging transaction; rolled back','result',current_setting('gyms.meal_commit_checks'));
rollback;
