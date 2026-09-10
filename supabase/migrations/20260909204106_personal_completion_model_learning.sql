-- Forward-only staging candidate: per-athlete shadow model artifacts and predictions.
create table public.personal_model_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id text not null,
  algorithm_version text not null,
  source_model_id text not null,
  source_model_version text not null,
  status text not null check(status in ('shadow','qualified','retired')),
  training_start_on date not null,
  trained_through date not null,
  training_days integer not null check(training_days >= 12),
  positive_days integer not null check(positive_days >= 1),
  negative_days integer not null check(negative_days >= 1),
  evidence_fingerprint text not null check(evidence_fingerprint ~ '^[a-f0-9]{64}$'),
  parameters jsonb not null check(jsonb_typeof(parameters)='object'),
  qualification jsonb,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  check(positive_days + negative_days = training_days),
  check(training_start_on <= trained_through),
  unique(user_id,model_id,algorithm_version,evidence_fingerprint)
);
create unique index personal_model_artifacts_one_active_idx
  on public.personal_model_artifacts(user_id,model_id)
  where status in ('shadow','qualified');
create index personal_model_artifacts_owner_recent_idx
  on public.personal_model_artifacts(user_id,created_at desc,id desc);

create table public.personal_model_predictions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  artifact_id uuid not null references public.personal_model_artifacts(id) on delete restrict,
  decision_id uuid not null references public.decision_records(id) on delete cascade,
  decision_on date not null,
  prediction jsonb not null check(jsonb_typeof(prediction)='object'),
  created_at timestamptz not null default now(),
  unique(user_id,artifact_id,decision_id)
);
create index personal_model_predictions_owner_pending_idx
  on public.personal_model_predictions(user_id,decision_on,id);

alter table public.personal_model_artifacts enable row level security;
alter table public.personal_model_predictions enable row level security;
revoke all on public.personal_model_artifacts,public.personal_model_predictions from public,anon,authenticated;
grant select on public.personal_model_artifacts,public.personal_model_predictions to authenticated;
grant all on public.personal_model_artifacts,public.personal_model_predictions to service_role;
create policy personal_model_artifacts_owner_read
  on public.personal_model_artifacts for select to authenticated
  using(user_id=(select auth.uid()));
create policy personal_model_predictions_owner_read
  on public.personal_model_predictions for select to authenticated
  using(user_id=(select auth.uid()));

create function public.commit_personal_model_prediction(
  p_user_id uuid,
  p_artifact_id uuid,
  p_decision_id uuid,
  p_decision_on date,
  p_prediction jsonb
) returns uuid
language plpgsql security invoker set search_path='' as $$
declare result_id uuid;
begin
  if p_prediction is null or jsonb_typeof(p_prediction)<>'object' then
    raise exception 'PERSONAL_MODEL_INVALID_PREDICTION';
  end if;
  if not exists(select 1 from public.personal_model_artifacts
    where id=p_artifact_id and user_id=p_user_id and status in ('shadow','qualified')) then
    raise exception 'PERSONAL_MODEL_ARTIFACT_UNAVAILABLE';
  end if;
  if not exists(select 1 from public.decision_records
    where id=p_decision_id and user_id=p_user_id and decision_on=p_decision_on) then
    raise exception 'PERSONAL_MODEL_DECISION_UNAVAILABLE';
  end if;
  insert into public.personal_model_predictions(id,user_id,artifact_id,decision_id,decision_on,prediction)
  values((p_prediction->>'id')::uuid,p_user_id,p_artifact_id,p_decision_id,p_decision_on,p_prediction)
  on conflict(user_id,artifact_id,decision_id) do nothing
  returning id into result_id;
  if result_id is null then
    select id into result_id from public.personal_model_predictions
      where user_id=p_user_id and artifact_id=p_artifact_id and decision_id=p_decision_id;
  end if;
  return result_id;
end $$;
revoke all on function public.commit_personal_model_prediction(uuid,uuid,uuid,date,jsonb)
  from public,anon,authenticated;
grant execute on function public.commit_personal_model_prediction(uuid,uuid,uuid,date,jsonb)
  to service_role;
