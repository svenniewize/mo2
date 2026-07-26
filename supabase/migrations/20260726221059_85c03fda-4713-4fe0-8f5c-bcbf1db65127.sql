CREATE TABLE public.anansi_web (
  session_id text NOT NULL,
  word text NOT NULL,
  role text NOT NULL,
  weight double precision NOT NULL DEFAULT 0,
  uses integer NOT NULL DEFAULT 1,
  last_manifold text,
  last_used timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, word, role)
);

GRANT ALL ON public.anansi_web TO service_role;

ALTER TABLE public.anansi_web ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service only anansi_web"
  ON public.anansi_web FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.anansi_web_bump(rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.anansi_web (session_id, word, role, weight, uses, last_manifold)
  SELECT
    (r ->> 'session_id')::text,
    (r ->> 'word')::text,
    (r ->> 'role')::text,
    (r ->> 'weight')::double precision,
    COALESCE((r ->> 'uses')::integer, 1),
    (r ->> 'last_manifold')::text
  FROM jsonb_array_elements(rows) AS r
  ON CONFLICT (session_id, word, role)
  DO UPDATE SET
    weight = public.anansi_web.weight + EXCLUDED.weight,
    uses   = public.anansi_web.uses + EXCLUDED.uses,
    last_manifold = COALESCE(EXCLUDED.last_manifold, public.anansi_web.last_manifold),
    last_used = now();
END;
$$;