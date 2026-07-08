
CREATE TABLE public.life_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'inbox',
  manifold TEXT,
  source TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.life_notes TO service_role;
ALTER TABLE public.life_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only life_notes" ON public.life_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX life_notes_session_idx ON public.life_notes(session_id, created_at DESC);

CREATE TABLE public.life_remembers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT 'neutral',
  manifold TEXT,
  source TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.life_remembers TO service_role;
ALTER TABLE public.life_remembers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only life_remembers" ON public.life_remembers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX life_remembers_session_idx ON public.life_remembers(session_id, created_at DESC);

CREATE TABLE public.life_shitposts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  form TEXT NOT NULL DEFAULT 'freeverse',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.life_shitposts TO service_role;
ALTER TABLE public.life_shitposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only life_shitposts" ON public.life_shitposts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX life_shitposts_session_idx ON public.life_shitposts(session_id, created_at DESC);
