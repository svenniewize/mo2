
CREATE TABLE public.mo_traces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  manifold TEXT,
  pressure REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mo_traces TO anon, authenticated;
GRANT ALL ON public.mo_traces TO service_role;
ALTER TABLE public.mo_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open traces" ON public.mo_traces FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.fielfold_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  manifold TEXT,
  depth INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fielfold_entries TO anon, authenticated;
GRANT ALL ON public.fielfold_entries TO service_role;
ALTER TABLE public.fielfold_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open fielfold" ON public.fielfold_entries FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  lyrics TEXT NOT NULL,
  held BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.songs TO anon, authenticated;
GRANT ALL ON public.songs TO service_role;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open songs" ON public.songs FOR ALL USING (true) WITH CHECK (true);
