ALTER TABLE public.body_metrics
  ADD COLUMN IF NOT EXISTS hips_cm numeric,
  ADD COLUMN IF NOT EXISTS thigh_cm numeric,
  ADD COLUMN IF NOT EXISTS neck_cm numeric;