-- `body_metrics` holds two kinds of number under the same column names, and
-- nothing recorded which was which.
--
-- One path is a scale: the athlete weighs themselves and types it in. The
-- other is the photo scan, where `body_fat` is a blend of two clinical
-- formulas *and a vision model's visual estimate*, and `weight_kg` is the
-- model's own guess whenever the athlete did not supply one. The scan reports
-- a confidence on screen; the moment the number reached this table that
-- confidence was gone.
--
-- Everything downstream then treated all of it as measured: the body
-- composition card says "only weight and body fat percentage are measured",
-- the signal rail labels both "entered by hand", hydration targets scale off
-- the weight, the meal planner rewrites calorie targets from it, and the
-- medical report hands the lot to a physician.
--
-- Per field, not per row, because both writers upsert on
-- (user_id, measured_on) and PostgREST updates only the columns it is given:
-- a hand-typed weight and a photo-estimated body fat legitimately share one
-- row, and a single source column would have to lie about one of them.
alter table public.body_metrics
  add column if not exists weight_source text,
  add column if not exists body_fat_source text;

alter table public.body_metrics
  drop constraint if exists body_metrics_weight_source_check;
alter table public.body_metrics
  add constraint body_metrics_weight_source_check
  check (weight_source is null or weight_source in ('measured', 'photo_estimate'));

alter table public.body_metrics
  drop constraint if exists body_metrics_body_fat_source_check;
alter table public.body_metrics
  add constraint body_metrics_body_fat_source_check
  check (body_fat_source is null or body_fat_source in ('measured', 'photo_estimate'));

-- Nullable with no default and no backfill. Rows written before these columns
-- existed came from either path, and the circumference columns only hint at
-- which — inventing a provenance from a hint is exactly the failure these
-- columns exist to prevent. They say "not recorded" instead.
comment on column public.body_metrics.weight_source is
  'How the weight was obtained: measured (a scale, entered by the athlete) or photo_estimate (a vision model''s estimate from a photo). Null for rows written before provenance was recorded.';
comment on column public.body_metrics.body_fat_source is
  'How the body fat percentage was obtained: measured (entered by the athlete) or photo_estimate (a blend that includes a vision model''s visual estimate). Null for rows written before provenance was recorded.';
comment on column public.body_metrics.waist_cm is
  'Written only by the photo scan, so always a vision model''s estimate, never a tape measure.';
