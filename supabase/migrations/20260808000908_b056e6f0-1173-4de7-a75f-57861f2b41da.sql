CREATE TABLE public.cadence_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  walk_index bigint NOT NULL,
  watch text NOT NULL,
  manifold text NOT NULL,
  pressure real NOT NULL DEFAULT 0,
  stability real NOT NULL DEFAULT 0,
  divergence real NOT NULL DEFAULT 0,
  loopiness real NOT NULL DEFAULT 0,
  role_words jsonb NOT NULL DEFAULT '{}'::jsonb,
  shape jsonb NOT NULL DEFAULT '[]'::jsonb,
  strength real NOT NULL DEFAULT 1,
  uses integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, walk_index)
);
GRANT ALL ON public.cadence_memory TO service_role;
ALTER TABLE public.cadence_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only cadence_memory" ON public.cadence_memory FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX cadence_memory_session_strength_idx ON public.cadence_memory (session_id, strength DESC, last_used DESC);
CREATE INDEX cadence_memory_session_recent_idx ON public.cadence_memory (session_id, walk_index DESC);