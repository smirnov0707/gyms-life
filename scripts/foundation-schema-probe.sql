-- Read-only release preflight. Does not mutate users, migrations, or schema.
-- Run separately against the authorized staging and production project.
-- This checks the core rollout contract, not total product correctness.
with required_functions(label, signature) as (values
  ('activate_training_plan', 'public.activate_training_plan(uuid)'),
  ('activate_meal_plan', 'public.activate_meal_plan(uuid)'),
  ('commit_generated_meal_plan', 'public.commit_generated_meal_plan(uuid,timestamp with time zone,jsonb,jsonb,text)')
), functions as (
  select f.label, p.oid, p.prosecdef, pg_get_function_result(p.oid) as result,
    case when p.oid is not null then md5(pg_get_functiondef(p.oid)) end as definition_md5,
    case when p.oid is not null then has_function_privilege('authenticated',p.oid,'EXECUTE') else false end as authenticated_execute,
    case when p.oid is not null then has_function_privilege('anon',p.oid,'EXECUTE') else false end as anonymous_execute
  from required_functions f left join pg_proc p on p.oid=to_regprocedure(f.signature)
), parent_policies(table_name, policy_name) as (values
  ('workout_sessions','workout_sessions_parent_ownership'),
  ('set_logs','set_logs_parent_ownership')
)
select jsonb_build_object(
  'schema','gyms-foundation-preflight.v1',
  'captured_at',now(),
  'functions',(select jsonb_object_agg(label,jsonb_build_object(
    'present',oid is not null,'security_definer',prosecdef,
    'result',result,'definition_md5',definition_md5,
    'authenticated_execute',authenticated_execute,'anonymous_execute',anonymous_execute
  )) from functions),
  'parent_policies',(select jsonb_object_agg(w.policy_name,jsonb_build_object(
    'present',p.policyname is not null,'table',w.table_name,
    'restrictive',coalesce(p.permissive='RESTRICTIVE',false),
    'command',p.cmd,'roles',p.roles,'using',p.qual,'check',p.with_check
  )) from parent_policies w left join pg_policies p
     on p.schemaname='public' and p.tablename=w.table_name and p.policyname=w.policy_name),
  'rls',(select jsonb_object_agg(c.relname,c.relrowsecurity)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('profiles','plans','meal_plans','workout_sessions','set_logs')),
  'recent_migrations',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) order by version),'[]'::jsonb)
    from supabase_migrations.schema_migrations where version>='20260908000000')
) as foundation_preflight;
