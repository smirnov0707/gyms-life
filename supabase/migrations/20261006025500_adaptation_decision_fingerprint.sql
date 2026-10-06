alter table public.endurance_adaptation_records
  add column if not exists decision_fingerprint text;

update public.endurance_adaptation_records
set decision_fingerprint = md5(
  concat_ws(
    '|',
    user_id::text,
    race_goal_id::text,
    decision_on::text,
    engine_version,
    action,
    volume_modifier::text,
    reason
  )
)
where decision_fingerprint is null;

alter table public.endurance_adaptation_records
  alter column decision_fingerprint set not null;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.endurance_adaptation_records'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%user_id, race_goal_id, decision_on, engine_version%'
      and pg_get_constraintdef(oid) not like '%decision_fingerprint%'
  loop
    execute format(
      'alter table public.endurance_adaptation_records drop constraint %I',
      constraint_name
    );
  end loop;
end$$;

create unique index if not exists endurance_adaptation_decision_fingerprint_uidx
  on public.endurance_adaptation_records(
    user_id,
    race_goal_id,
    decision_on,
    engine_version,
    decision_fingerprint
  );

alter table public.endurance_adaptation_records
  drop constraint if exists endurance_adaptation_records_decision_fingerprint_check,
  add constraint endurance_adaptation_records_decision_fingerprint_check
    check(decision_fingerprint ~ '^[a-f0-9]{32,64}$');
