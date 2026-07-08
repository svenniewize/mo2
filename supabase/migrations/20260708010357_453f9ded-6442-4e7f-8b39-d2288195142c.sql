
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow all operations on mo_traces" ON public.mo_traces;
DROP POLICY IF EXISTS "Allow all operations on fielfold_entries" ON public.fielfold_entries;
DROP POLICY IF EXISTS "Allow all operations on songs" ON public.songs;
DROP POLICY IF EXISTS "public can do all on mo_traces" ON public.mo_traces;
DROP POLICY IF EXISTS "public can do all on fielfold_entries" ON public.fielfold_entries;
DROP POLICY IF EXISTS "public can do all on songs" ON public.songs;

-- Revoke all direct access from anon/authenticated roles.
-- All app access happens through server routes using the service_role key.
REVOKE ALL ON public.mo_traces FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.fielfold_entries FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.songs FROM anon, authenticated, PUBLIC;

-- Ensure service_role retains full access (bypasses RLS anyway, but be explicit).
GRANT ALL ON public.mo_traces TO service_role;
GRANT ALL ON public.fielfold_entries TO service_role;
GRANT ALL ON public.songs TO service_role;

-- Keep RLS enabled with no policies = deny-by-default for anon/authenticated.
ALTER TABLE public.mo_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fielfold_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
