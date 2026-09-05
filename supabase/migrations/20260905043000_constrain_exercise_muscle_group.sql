-- `exercises.muscle_group` decides where an exercise's training load lands on
-- the Digital Twin's body map. It was open text with no constraint, so a typo
-- in a future exercise row would not fail — the exercise would simply stop
-- appearing anywhere on the figure, silently, with no error to notice.
--
-- All 11 values in production are already known to the app. This closes the
-- set so an unmapped value fails at write time instead of disappearing.
--
-- Keep in sync with KNOWN_MUSCLE_GROUPS in src/lib/muscle-load.schema.ts and
-- with BODY_REGION_SEGMENTS in src/components/twin/body-map.geometry.ts:
-- adding a value here without giving it a place on the body (or an entry in
-- NON_ANATOMICAL_GROUPS) puts load somewhere nothing renders it.

alter table public.exercises
  add constraint exercises_muscle_group_known
  check (
    muscle_group in (
      'legs',
      'back',
      'arms',
      'chest',
      'shoulders',
      'fullbody',
      'cardio',
      'core',
      'glutes',
      'abs',
      'mobility'
    )
  );
