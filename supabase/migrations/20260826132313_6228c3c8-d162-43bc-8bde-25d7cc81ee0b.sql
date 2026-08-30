CREATE TABLE public.supplements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  times_per_day INTEGER NOT NULL DEFAULT 1,
  with_food BOOLEAN NOT NULL DEFAULT false,
  preferred_time TEXT NOT NULL DEFAULT 'any',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplements TO authenticated;
GRANT ALL ON public.supplements TO service_role;
ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own supplements" ON public.supplements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_supplements_updated_at BEFORE UPDATE ON public.supplements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();