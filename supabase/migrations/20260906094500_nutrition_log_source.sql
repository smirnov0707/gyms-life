-- Every row in nutrition_logs is a language model's estimate: one path has the
-- athlete describe a meal, the other photographs it, and a model returns the
-- macros. There is no manual-entry path. Nothing recorded that, so the
-- micronutrient scan, the nutrition targets and the medical report a physician
-- reads all treated estimated intake as measured intake.
--
-- Deliberately nullable with no default. Rows written before this column
-- existed came from either path and inventing a provenance for them would be
-- exactly the failure the column exists to prevent; they say "not recorded"
-- instead.
alter table public.nutrition_logs
  add column if not exists source text;

alter table public.nutrition_logs
  drop constraint if exists nutrition_logs_source_check;

alter table public.nutrition_logs
  add constraint nutrition_logs_source_check
  check (source is null or source in ('text_estimate', 'photo_estimate'));

comment on column public.nutrition_logs.source is
  'How the macros were produced: text_estimate (model, from a description), photo_estimate (vision model, from an image). Null for rows written before provenance was recorded.';
