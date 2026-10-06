alter table public.endurance_adaptation_records add column if not exists decision_fingerprint text;

update public.endurance_adaptation_records
set decision_fingerprint =
  md5(concat_ws('|', user_id::text, race_goal_id::text, decision_on::text, engine_version, action, volume_modifier::text, reason, evidence::text))
  || md5(concat_ws('|', evidence::text, reason, action, engine_version, decision_on::text, race_goal_id::text, user_id::text))
where decision_fingerprint is null;

alter table public.endurance_adaptation_records alter column decision_fingerprint set not null;
alter table public.endurance_adaptation_records drop constraint if exists endurance_adaptation_records_decision_fingerprint_check;
alter table public.endurance_adaptation_records add constraint endurance_adaptation_records_decision_fingerprint_check check(decision_fingerprint ~ '^[a-f0-9]{64}$');

drop index if exists endurance_adaptation_records_user_id_race_goal_id_decision_on_engine_version_key;
create unique index if not exists endurance_adaptation_decision_fingerprint_uidx
  on public.endurance_adaptation_records(user_id,race_goal_id,decision_on,engine_version,decision_fingerprint);
