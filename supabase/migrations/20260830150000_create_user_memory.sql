CREATE TABLE IF NOT EXISTS public.user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'preference','goal','constraint','pattern','fact',
    'coaching','nutrition','training','recovery'
  )),
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system' CHECK (source IN (
    'user','conversation','behavior','insight','system'
  )),
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.500 CHECK (confidence >= 0 AND confidence <= 1),
  importance NUMERIC(4,3) NOT NULL DEFAULT 0.500 CHECK (importance >= 0 AND importance <= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active','superseded','dismissed'
  )),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_memory_user_status_idx
  ON public.user_memory(user_id, status);

CREATE INDEX IF NOT EXISTS user_memory_user_type_idx
  ON public.user_memory(user_id, memory_type);

CREATE INDEX IF NOT EXISTS user_memory_user_importance_idx
  ON public.user_memory(user_id, importance DESC);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own memory" ON public.user_memory;

CREATE POLICY "Users read own memory"
  ON public.user_memory
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own memory" ON public.user_memory;

CREATE POLICY "Users delete own memory"
  ON public.user_memory
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, DELETE ON public.user_memory TO authenticated;
GRANT ALL ON public.user_memory TO service_role;
