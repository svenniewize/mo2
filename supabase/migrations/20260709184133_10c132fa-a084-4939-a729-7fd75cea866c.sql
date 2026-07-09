CREATE TABLE public.gremolin_lexicon (
  session_id text NOT NULL,
  word text NOT NULL,
  uses integer NOT NULL DEFAULT 1,
  weight double precision NOT NULL DEFAULT 1,
  mutation text,
  last_manifold text,
  last_used timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, word)
);
GRANT ALL ON public.gremolin_lexicon TO service_role;
ALTER TABLE public.gremolin_lexicon ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only gremolin_lexicon" ON public.gremolin_lexicon FOR ALL TO service_role USING (true) WITH CHECK (true);