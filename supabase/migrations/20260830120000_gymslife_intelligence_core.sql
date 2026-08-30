-- GYMS.LIFE Intelligence Core
-- Central, user-owned memory for observations and proactive insights.
CREATE TABLE IF NOT EXISTS public.user_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','positive','attention','critical')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','seen','dismissed','resolved')),
  fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS user_insights_user_created_idx ON public.user_insights(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_insights_user_status_idx ON public.user_insights(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS user_insights_fingerprint_idx ON public.user_insights(user_id, fingerprint) WHERE fingerprint IS NOT NULL;
ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own insights" ON public.user_insights;
CREATE POLICY "Users manage own insights" ON public.user_insights FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_insights TO authenticated;
GRANT ALL ON public.user_insights TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  task TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  input_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  latency_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_interactions_user_created_idx ON public.ai_interactions(user_id, created_at DESC);
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own AI interactions" ON public.ai_interactions;
CREATE POLICY "Users read own AI interactions" ON public.ai_interactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
GRANT SELECT ON public.ai_interactions TO authenticated;
GRANT ALL ON public.ai_interactions TO service_role;
