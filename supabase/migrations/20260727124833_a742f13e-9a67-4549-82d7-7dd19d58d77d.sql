
CREATE TABLE public.prog_mo_crystals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  signature text NOT NULL,
  pattern text[] NOT NULL,
  kind text NOT NULL DEFAULT 'motif',
  uses integer NOT NULL DEFAULT 1,
  first_seen timestamp with time zone NOT NULL DEFAULT now(),
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (session_id, signature)
);
GRANT ALL ON public.prog_mo_crystals TO service_role;
ALTER TABLE public.prog_mo_crystals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prog_mo_crystals service only" ON public.prog_mo_crystals FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.prog_mo_manifolds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL DEFAULT 'global',
  slug text NOT NULL,
  name text NOT NULL,
  sigil text NOT NULL DEFAULT '◈',
  color text NOT NULL DEFAULT '#7DE2D1',
  breath text NOT NULL DEFAULT '',
  text text NOT NULL,
  kind text NOT NULL DEFAULT 'language',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (session_id, slug)
);
GRANT ALL ON public.prog_mo_manifolds TO service_role;
ALTER TABLE public.prog_mo_manifolds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prog_mo_manifolds service only" ON public.prog_mo_manifolds FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.prog_mo_hyperfold_edges (
  word_a text NOT NULL,
  word_b text NOT NULL,
  weight double precision NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (word_a, word_b)
);
GRANT ALL ON public.prog_mo_hyperfold_edges TO service_role;
ALTER TABLE public.prog_mo_hyperfold_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prog_mo_hyperfold_edges service only" ON public.prog_mo_hyperfold_edges FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.prog_mo_hyperfold_bump(edges jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.prog_mo_hyperfold_edges (word_a, word_b, weight)
  SELECT (e->>'a')::text, (e->>'b')::text, (e->>'w')::double precision
  FROM jsonb_array_elements(edges) AS e
  ON CONFLICT (word_a, word_b) DO UPDATE SET
    weight = public.prog_mo_hyperfold_edges.weight + EXCLUDED.weight,
    updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.prog_mo_crystal_bump(sid text, sig text, pat text[], k text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.prog_mo_crystals (session_id, signature, pattern, kind)
  VALUES (sid, sig, pat, k)
  ON CONFLICT (session_id, signature) DO UPDATE SET
    uses = public.prog_mo_crystals.uses + 1,
    last_seen = now();
END; $$;
