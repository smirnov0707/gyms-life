drop extension if exists "pg_net";

drop policy "Users read own AI interactions" on "public"."ai_interactions";

drop policy "Users manage own insights" on "public"."user_insights";

drop policy "Users delete own memory" on "public"."user_memory";

drop policy "Users read own memory" on "public"."user_memory";

revoke delete on table "public"."ai_interactions" from "anon";

revoke insert on table "public"."ai_interactions" from "anon";

revoke references on table "public"."ai_interactions" from "anon";

revoke select on table "public"."ai_interactions" from "anon";

revoke trigger on table "public"."ai_interactions" from "anon";

revoke truncate on table "public"."ai_interactions" from "anon";

revoke update on table "public"."ai_interactions" from "anon";

revoke delete on table "public"."ai_interactions" from "authenticated";

revoke insert on table "public"."ai_interactions" from "authenticated";

revoke references on table "public"."ai_interactions" from "authenticated";

revoke select on table "public"."ai_interactions" from "authenticated";

revoke trigger on table "public"."ai_interactions" from "authenticated";

revoke truncate on table "public"."ai_interactions" from "authenticated";

revoke update on table "public"."ai_interactions" from "authenticated";

revoke delete on table "public"."ai_interactions" from "service_role";

revoke insert on table "public"."ai_interactions" from "service_role";

revoke references on table "public"."ai_interactions" from "service_role";

revoke select on table "public"."ai_interactions" from "service_role";

revoke trigger on table "public"."ai_interactions" from "service_role";

revoke truncate on table "public"."ai_interactions" from "service_role";

revoke update on table "public"."ai_interactions" from "service_role";

revoke delete on table "public"."user_insights" from "anon";

revoke insert on table "public"."user_insights" from "anon";

revoke references on table "public"."user_insights" from "anon";

revoke select on table "public"."user_insights" from "anon";

revoke trigger on table "public"."user_insights" from "anon";

revoke truncate on table "public"."user_insights" from "anon";

revoke update on table "public"."user_insights" from "anon";

revoke delete on table "public"."user_insights" from "authenticated";

revoke insert on table "public"."user_insights" from "authenticated";

revoke references on table "public"."user_insights" from "authenticated";

revoke select on table "public"."user_insights" from "authenticated";

revoke trigger on table "public"."user_insights" from "authenticated";

revoke truncate on table "public"."user_insights" from "authenticated";

revoke update on table "public"."user_insights" from "authenticated";

revoke delete on table "public"."user_insights" from "service_role";

revoke insert on table "public"."user_insights" from "service_role";

revoke references on table "public"."user_insights" from "service_role";

revoke select on table "public"."user_insights" from "service_role";

revoke trigger on table "public"."user_insights" from "service_role";

revoke truncate on table "public"."user_insights" from "service_role";

revoke update on table "public"."user_insights" from "service_role";

revoke delete on table "public"."user_memory" from "anon";

revoke insert on table "public"."user_memory" from "anon";

revoke references on table "public"."user_memory" from "anon";

revoke select on table "public"."user_memory" from "anon";

revoke trigger on table "public"."user_memory" from "anon";

revoke truncate on table "public"."user_memory" from "anon";

revoke update on table "public"."user_memory" from "anon";

revoke delete on table "public"."user_memory" from "authenticated";

revoke insert on table "public"."user_memory" from "authenticated";

revoke references on table "public"."user_memory" from "authenticated";

revoke select on table "public"."user_memory" from "authenticated";

revoke trigger on table "public"."user_memory" from "authenticated";

revoke truncate on table "public"."user_memory" from "authenticated";

revoke update on table "public"."user_memory" from "authenticated";

revoke delete on table "public"."user_memory" from "service_role";

revoke insert on table "public"."user_memory" from "service_role";

revoke references on table "public"."user_memory" from "service_role";

revoke select on table "public"."user_memory" from "service_role";

revoke trigger on table "public"."user_memory" from "service_role";

revoke truncate on table "public"."user_memory" from "service_role";

revoke update on table "public"."user_memory" from "service_role";

alter table "public"."ai_interactions" drop constraint "ai_interactions_user_id_fkey";

alter table "public"."user_insights" drop constraint "user_insights_severity_check";

alter table "public"."user_insights" drop constraint "user_insights_status_check";

alter table "public"."user_insights" drop constraint "user_insights_user_id_fkey";

alter table "public"."user_memory" drop constraint "user_memory_confidence_check";

alter table "public"."user_memory" drop constraint "user_memory_importance_check";

alter table "public"."user_memory" drop constraint "user_memory_memory_type_check";

alter table "public"."user_memory" drop constraint "user_memory_source_check";

alter table "public"."user_memory" drop constraint "user_memory_status_check";

alter table "public"."user_memory" drop constraint "user_memory_user_id_fkey";

alter table "public"."ai_interactions" drop constraint "ai_interactions_pkey";

alter table "public"."user_insights" drop constraint "user_insights_pkey";

alter table "public"."user_memory" drop constraint "user_memory_pkey";

drop index if exists "public"."ai_interactions_pkey";

drop index if exists "public"."ai_interactions_user_created_idx";

drop index if exists "public"."user_insights_fingerprint_idx";

drop index if exists "public"."user_insights_pkey";

drop index if exists "public"."user_insights_user_created_idx";

drop index if exists "public"."user_insights_user_status_idx";

drop index if exists "public"."user_memory_pkey";

drop index if exists "public"."user_memory_user_importance_idx";

drop index if exists "public"."user_memory_user_status_idx";

drop index if exists "public"."user_memory_user_type_idx";

drop table "public"."ai_interactions";

drop table "public"."user_insights";

drop table "public"."user_memory";


  create table "public"."ai_usage_daily" (
    "user_id" uuid not null,
    "usage_date" date not null default CURRENT_DATE,
    "request_count" integer not null default 0,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_usage_daily" enable row level security;


  create table "public"."paddle_webhook_events" (
    "event_id" text not null,
    "event_type" text not null,
    "environment" text not null,
    "received_at" timestamp with time zone not null default now()
      );


alter table "public"."paddle_webhook_events" enable row level security;

alter table "public"."meal_plans" drop column "i18n";

alter table "public"."meal_plans" drop column "lang";

CREATE UNIQUE INDEX ai_usage_daily_pkey ON public.ai_usage_daily USING btree (user_id, usage_date);

CREATE UNIQUE INDEX paddle_webhook_events_pkey ON public.paddle_webhook_events USING btree (event_id);

alter table "public"."ai_usage_daily" add constraint "ai_usage_daily_pkey" PRIMARY KEY using index "ai_usage_daily_pkey";

alter table "public"."paddle_webhook_events" add constraint "paddle_webhook_events_pkey" PRIMARY KEY using index "paddle_webhook_events_pkey";

alter table "public"."ai_usage_daily" add constraint "ai_usage_daily_request_count_check" CHECK ((request_count >= 0)) not valid;

alter table "public"."ai_usage_daily" validate constraint "ai_usage_daily_request_count_check";

alter table "public"."ai_usage_daily" add constraint "ai_usage_daily_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."ai_usage_daily" validate constraint "ai_usage_daily_user_id_fkey";

alter table "public"."paddle_webhook_events" add constraint "paddle_webhook_events_environment_check" CHECK ((environment = ANY (ARRAY['sandbox'::text, 'live'::text]))) not valid;

alter table "public"."paddle_webhook_events" validate constraint "paddle_webhook_events_environment_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_user_id uuid, p_limit integer DEFAULT 50)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_count integer;
begin
  insert into public.ai_usage_daily(user_id, usage_date, request_count, updated_at)
  values (p_user_id, current_date, 1, now())
  on conflict (user_id, usage_date) do update
    set request_count = public.ai_usage_daily.request_count + 1,
        updated_at = now()
    where public.ai_usage_daily.request_count < greatest(p_limit, 1)
  returning request_count into new_count;

  return new_count is not null and new_count <= greatest(p_limit, 1);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

grant delete on table "public"."ai_usage_daily" to "anon";

grant insert on table "public"."ai_usage_daily" to "anon";

grant references on table "public"."ai_usage_daily" to "anon";

grant select on table "public"."ai_usage_daily" to "anon";

grant trigger on table "public"."ai_usage_daily" to "anon";

grant truncate on table "public"."ai_usage_daily" to "anon";

grant update on table "public"."ai_usage_daily" to "anon";

grant delete on table "public"."ai_usage_daily" to "authenticated";

grant insert on table "public"."ai_usage_daily" to "authenticated";

grant references on table "public"."ai_usage_daily" to "authenticated";

grant select on table "public"."ai_usage_daily" to "authenticated";

grant trigger on table "public"."ai_usage_daily" to "authenticated";

grant truncate on table "public"."ai_usage_daily" to "authenticated";

grant update on table "public"."ai_usage_daily" to "authenticated";

grant delete on table "public"."ai_usage_daily" to "service_role";

grant insert on table "public"."ai_usage_daily" to "service_role";

grant references on table "public"."ai_usage_daily" to "service_role";

grant select on table "public"."ai_usage_daily" to "service_role";

grant trigger on table "public"."ai_usage_daily" to "service_role";

grant truncate on table "public"."ai_usage_daily" to "service_role";

grant update on table "public"."ai_usage_daily" to "service_role";

grant delete on table "public"."paddle_webhook_events" to "anon";

grant insert on table "public"."paddle_webhook_events" to "anon";

grant references on table "public"."paddle_webhook_events" to "anon";

grant select on table "public"."paddle_webhook_events" to "anon";

grant trigger on table "public"."paddle_webhook_events" to "anon";

grant truncate on table "public"."paddle_webhook_events" to "anon";

grant update on table "public"."paddle_webhook_events" to "anon";

grant delete on table "public"."paddle_webhook_events" to "authenticated";

grant insert on table "public"."paddle_webhook_events" to "authenticated";

grant references on table "public"."paddle_webhook_events" to "authenticated";

grant select on table "public"."paddle_webhook_events" to "authenticated";

grant trigger on table "public"."paddle_webhook_events" to "authenticated";

grant truncate on table "public"."paddle_webhook_events" to "authenticated";

grant update on table "public"."paddle_webhook_events" to "authenticated";

grant delete on table "public"."paddle_webhook_events" to "service_role";

grant insert on table "public"."paddle_webhook_events" to "service_role";

grant references on table "public"."paddle_webhook_events" to "service_role";

grant select on table "public"."paddle_webhook_events" to "service_role";

grant trigger on table "public"."paddle_webhook_events" to "service_role";

grant truncate on table "public"."paddle_webhook_events" to "service_role";

grant update on table "public"."paddle_webhook_events" to "service_role";


