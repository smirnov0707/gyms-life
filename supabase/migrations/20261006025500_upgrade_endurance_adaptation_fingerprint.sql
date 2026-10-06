-- Forward-compatible upgrade for databases that already applied the first
-- endurance adaptation ledger migration before decision fingerprints existed.
alter table public.endurance_adaptation_records
  add column if not exists decision_fingerprint text;

update public.endurance_adaptation_records
set decision_fingerprint =
  md5(
    concat_ws(
      '|',
      id::text,
      user_id::text,
      race_goal_id::text,
      decision_on::text,
      engine_version,
      action,
      volume_modifier::text,
      reason
    )
  ) ||
  md5(
    concat_ws(
      '|',
      id::text,
      created_at::text,
      evidence::text,
      'endurance-adaptation-fingerprint-v1'
    )
  )
where decision_fingerprint is null;

alter table public.endurance_adaptation_records
  alter column decision_fingerprint set not null;

alter table public.endurance_adaptation_records
  drop constraint if exists endurance_adaptation_records_decision_fingerprint_check;

alter table public.endurance_adaptation_records
  add constraint endurance_adaptation_records_decision_fingerprint_check
  check (decision_fingerprint ~ '^[a-f0-9]{64}$');

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.endurance_adaptation_records'::regclass
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%user_id%'
      and pg_get_constraintdef(c.oid) like '%race_goal_id%'
      and pg_get_constraintdef(c.oid) like '%decision_on%'
      and pg_get_constraintdef(c.oid) like '%engine_version%'
      and pg_get_constraintdef(c.oid) not like '%decision_fingerprint%'
  loop
    execute format(
      'alter table public.endurance_adaptation_records drop constraint %I',
      constraint_name
    );
  end loop;
end;
$$;

create unique index if not exists endurance_adaptation_records_decision_identity_idx
  on public.endurance_adaptation_records(
    user_id,
    race_goal_id,
    decision_on,
    engine_version,
    decision_fingerprint
  );
