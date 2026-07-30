CREATE TABLE public.cadence_state (
  session_id text PRIMARY KEY,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  steps integer NOT NULL DEFAULT 0,
  loss real NOT NULL DEFAULT 0,
  vocab_size integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cadence_state TO service_role;
ALTER TABLE public.cadence_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only cadence_state" ON public.cadence_state FOR ALL USING (true) WITH CHECK (true);