-- RLS controls ownership; these constraints protect metric integrity even when
-- an authenticated client bypasses the application UI and calls the API directly.
-- NOT VALID preserves any historical rows while enforcing every new write.
alter table public.body_metrics
  add constraint body_metrics_weight_kg_range
    check (weight_kg is null or (weight_kg > 0 and weight_kg <= 500)) not valid,
  add constraint body_metrics_body_fat_range
    check (body_fat is null or (body_fat >= 0 and body_fat <= 100)) not valid,
  add constraint body_metrics_circumference_ranges
    check (
      (waist_cm is null or (waist_cm > 0 and waist_cm <= 300))
      and (chest_cm is null or (chest_cm > 0 and chest_cm <= 300))
      and (hips_cm is null or (hips_cm > 0 and hips_cm <= 300))
      and (arm_cm is null or (arm_cm > 0 and arm_cm <= 150))
      and (thigh_cm is null or (thigh_cm > 0 and thigh_cm <= 200))
      and (neck_cm is null or (neck_cm > 0 and neck_cm <= 150))
    ) not valid;
