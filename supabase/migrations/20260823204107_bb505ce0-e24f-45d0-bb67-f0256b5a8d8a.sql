CREATE TABLE public.daily_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_on date NOT NULL DEFAULT CURRENT_DATE,
  sleep_hours numeric,
  sleep_quality integer,
  soreness integer,
  stress integer,
  energy integer,
  mood integer,
  readiness_score integer,
  advice text,
  load_modifier numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_on)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own checkins" ON public.daily_checkins FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER daily_checkins_updated BEFORE UPDATE ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.form_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_slug text NOT NULL,
  exercise_name text NOT NULL,
  score integer,
  verdict text,
  good text,
  fixes text,
  drills text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_analyses TO authenticated;
GRANT ALL ON public.form_analyses TO service_role;

ALTER TABLE public.form_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own form analyses" ON public.form_analyses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);