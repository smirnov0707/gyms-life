alter table public.endurance_adaptation_records
  add column if not exists decision_fingerprint text;

update public.endurance_adaptation_records
set decision_fingerprint = encode(
  extensions.digest(
    concat_ws('|', id::text, user_id::text, race_goal_id::text, decision_on::text, engine_version),
    'sha256'
  ),
  'hex'
)
where decision_fingerprint is null;

alter table public.endurance_adaptation_records
  alter column decision_fingerprint set not null;

alter table public.endurance_adaptation_records
  drop constraint if exists endurance_adaptation_records_decision_fingerprint_check,
  add constraint endurance_adaptation_records_decision_fingerprint_check
    check (decision_fingerprint ~ '^[a-f0-9]{64}$');

create unique index if not exists endurance_adaptation_decision_fingerprint_uidx
  on public.endurance_adaptation_records(
    user_id,race_goal_id,decision_on,engine_version,decision_fingerprint
  );
