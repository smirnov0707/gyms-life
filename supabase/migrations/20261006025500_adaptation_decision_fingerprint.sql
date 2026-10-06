create extension if not exists pgcrypto;

alter table public.endurance_adaptation_records
  add column if not exists decision_fingerprint text;

update public.endurance_adaptation_records
set decision_fingerprint = encode(
  digest(
    concat_ws(
      '|',
      decision_on::text,
      engine_version,
      action,
      volume_modifier::text,
      reason,
      coalesce(evidence->>'plannedSessions', ''),
      coalesce(evidence->>'completedPlannedSessions', ''),
      coalesce(evidence->>'lowResponseStreak', ''),
      coalesce(evidence->>'readinessBand', ''),
      coalesce(evidence->>'distanceCompletionRatio', 'null'),
      coalesce(evidence->>'recentOverTargetRuns', '0')
    ),
    'sha256'
  ),
  'hex'
)
where decision_fingerprint is null;

alter table public.endurance_adaptation_records
  alter column decision_fingerprint set not null;

alter table public.endurance_adaptation_records
  drop constraint if exists endurance_adaptation_records_decision_fingerprint_check;

alter table public.endurance_adaptation_records
  add constraint endurance_adaptation_records_decision_fingerprint_check
  check (decision_fingerprint ~ '^[a-f0-9]{64}$');

do $migration$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.endurance_adaptation_records'::regclass
      and c.contype = 'u'
      and (
        select array_agg(a.attname order by u.ordinality)
        from unnest(c.conkey) with ordinality as u(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = c.conrelid
         and a.attnum = u.attnum
      ) = array['user_id','race_goal_id','decision_on','engine_version']
  loop
    execute format(
      'alter table public.endurance_adaptation_records drop constraint %I',
      constraint_name
    );
  end loop;
end;
$migration$;

create unique index if not exists endurance_adaptation_decision_fingerprint_uidx
  on public.endurance_adaptation_records(
    user_id,
    race_goal_id,
    decision_on,
    engine_version,
    decision_fingerprint
  );

drop function if exists public.record_endurance_adaptation(
  uuid,uuid,date,text,numeric,text,jsonb,text
);

create or replace function public.record_endurance_adaptation(
  p_user_id uuid,
  p_race_goal_id uuid,
  p_decision_on date,
  p_action text,
  p_volume_modifier numeric,
  p_reason text,
  p_evidence jsonb,
  p_engine_version text,
  p_decision_fingerprint text
)
returns table(id uuid,action text,volume_modifier numeric,reason text,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if auth.role()<>'service_role' then raise exception 'service role required';end if;
  if p_action not in ('hold','reduce','recover')
    or p_volume_modifier<=0 or p_volume_modifier>1
    or p_reason not in ('insufficient_evidence','on_track','repeated_low_response','low_readiness_and_missed_work','repeated_over_target_work')
    or p_decision_fingerprint !~ '^[a-f0-9]{64}$'
  then raise exception 'invalid adaptation';end if;
  if not exists(select 1 from public.endurance_race_goals g where g.id=p_race_goal_id and g.user_id=p_user_id)
  then raise exception 'race goal ownership mismatch';end if;

  return query
  insert into public.endurance_adaptation_records(
    user_id,race_goal_id,decision_on,action,volume_modifier,reason,evidence,engine_version,decision_fingerprint
  ) values(
    p_user_id,p_race_goal_id,p_decision_on,p_action,p_volume_modifier,p_reason,p_evidence,p_engine_version,p_decision_fingerprint
  )
  on conflict(user_id,race_goal_id,decision_on,engine_version,decision_fingerprint) do nothing
  returning endurance_adaptation_records.id,endurance_adaptation_records.action,
    endurance_adaptation_records.volume_modifier,endurance_adaptation_records.reason,
    endurance_adaptation_records.created_at;
end$$;

revoke all on function public.record_endurance_adaptation(uuid,uuid,date,text,numeric,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.record_endurance_adaptation(uuid,uuid,date,text,numeric,text,jsonb,text,text) to service_role;

