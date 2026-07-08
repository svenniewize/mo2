
CREATE TABLE public.mo_hyperfold_edges (
  word_a text NOT NULL,
  word_b text NOT NULL,
  weight double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (word_a, word_b)
);

CREATE INDEX mo_hyperfold_edges_word_a_idx ON public.mo_hyperfold_edges (word_a);

-- Server-only. All access flows through server routes using service_role.
REVOKE ALL ON public.mo_hyperfold_edges FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.mo_hyperfold_edges TO service_role;
ALTER TABLE public.mo_hyperfold_edges ENABLE ROW LEVEL SECURITY;

-- Batched incremental upsert. Input: jsonb array of {a, b, w}.
CREATE OR REPLACE FUNCTION public.mo_hyperfold_bump(edges jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mo_hyperfold_edges (word_a, word_b, weight)
  SELECT
    (e ->> 'a')::text,
    (e ->> 'b')::text,
    (e ->> 'w')::double precision
  FROM jsonb_array_elements(edges) AS e
  ON CONFLICT (word_a, word_b)
  DO UPDATE SET
    weight = public.mo_hyperfold_edges.weight + EXCLUDED.weight,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.mo_hyperfold_bump(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mo_hyperfold_bump(jsonb) TO service_role;
