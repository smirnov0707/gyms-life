-- `health_samples` records how long someone slept and nothing about how they
-- slept. HealthKit, Health Connect, Oura and WHOOP all report stages, and
-- every one of them is dropped on the floor today because there is nowhere
-- to put it.
--
-- Added before the source exists, deliberately. The ingest endpoint is the
-- contract those sources will post to, and a contract that cannot accept a
-- field is one every integration has to work around later. Nothing is
-- displayed as a stage until a stage actually arrives.
--
-- Minutes, not fractions: every provider reports stage durations, and a
-- percentage of a total that is itself uncertain compounds two estimates.
-- The percentages the athlete sees are computed from these at read time.
alter table public.health_samples
  add column if not exists sleep_awake_minutes numeric,
  add column if not exists sleep_rem_minutes numeric,
  add column if not exists sleep_deep_minutes numeric,
  add column if not exists sleep_core_minutes numeric;

-- A stage cannot be negative and cannot exceed a day. Anything outside that
-- is a unit error at the source, and storing it would put a nonsense
-- hypnogram in front of the athlete.
do $$
declare
  stage text;
begin
  foreach stage in array array[
    'sleep_awake_minutes', 'sleep_rem_minutes', 'sleep_deep_minutes', 'sleep_core_minutes'
  ]
  loop
    execute format(
      'alter table public.health_samples drop constraint if exists health_samples_%s_check',
      stage
    );
    execute format(
      'alter table public.health_samples add constraint health_samples_%s_check
         check (%I is null or (%I >= 0 and %I <= 1440))',
      stage, stage, stage, stage
    );
  end loop;
end $$;

comment on column public.health_samples.sleep_awake_minutes is
  'Minutes awake during the sleep window, as reported by the source. Null when the source did not report stages — never zero, which would claim an unbroken night.';
comment on column public.health_samples.sleep_rem_minutes is
  'Minutes of REM sleep as reported by the source. Null when not reported.';
comment on column public.health_samples.sleep_deep_minutes is
  'Minutes of deep sleep as reported by the source. Null when not reported.';
comment on column public.health_samples.sleep_core_minutes is
  'Minutes of core/light sleep as reported by the source. Null when not reported.';
