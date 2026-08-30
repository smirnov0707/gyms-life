-- Extended SmartFit Features Migration
CREATE TABLE IF NOT EXISTS public.vbt_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_slug TEXT NOT NULL,
  weight_kg NUMERIC NOT NULL,
  avg_velocity NUMERIC NOT NULL,
  peak_velocity NUMERIC NOT NULL,
  velocity_loss_pct NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vbt_logs TO authenticated;
GRANT ALL ON public.vbt_logs TO service_role;
ALTER TABLE public.vbt_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vbt logs" ON public.vbt_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.vision_meal_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dish_name TEXT NOT NULL,
  calories NUMERIC NOT NULL,
  protein NUMERIC NOT NULL,
  carbs NUMERIC NOT NULL,
  fat NUMERIC NOT NULL,
  items TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vision_meal_scans TO authenticated;
GRANT ALL ON public.vision_meal_scans TO service_role;
ALTER TABLE public.vision_meal_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vision meal scans" ON public.vision_meal_scans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);