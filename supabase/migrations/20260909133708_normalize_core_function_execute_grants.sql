-- Forward-only privilege normalization; no user rows or function bodies change.
-- Existing invoker functions already require auth.uid(); remove unnecessary anonymous EXECUTE as well.
revoke all on function public.activate_training_plan(uuid) from public, anon;
revoke all on function public.activate_meal_plan(uuid) from public, anon;
revoke all on function public.commit_generated_meal_plan(uuid,timestamptz,jsonb,jsonb,text) from public, anon;
grant execute on function public.activate_training_plan(uuid) to authenticated, service_role;
grant execute on function public.activate_meal_plan(uuid) to authenticated, service_role;
grant execute on function public.commit_generated_meal_plan(uuid,timestamptz,jsonb,jsonb,text) to authenticated, service_role;
