
-- Drop overly permissive public policies
DROP POLICY IF EXISTS "open songs" ON public.songs;
DROP POLICY IF EXISTS "open fielfold" ON public.fielfold_entries;
DROP POLICY IF EXISTS "open traces" ON public.mo_traces;

-- All access flows through server functions using the service_role admin client,
-- which bypasses RLS. Add explicit service_role-only policies so RLS-enabled
-- tables have documented policy coverage and anon/authenticated are denied.
CREATE POLICY "service only songs" ON public.songs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service only fielfold_entries" ON public.fielfold_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service only mo_traces" ON public.mo_traces
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service only life_tasks" ON public.life_tasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service only mo_hyperfold_edges" ON public.mo_hyperfold_edges
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Revoke any lingering anon/authenticated grants so only service_role reaches these tables
REVOKE ALL ON public.songs FROM anon, authenticated;
REVOKE ALL ON public.fielfold_entries FROM anon, authenticated;
REVOKE ALL ON public.mo_traces FROM anon, authenticated;
REVOKE ALL ON public.life_tasks FROM anon, authenticated;
REVOKE ALL ON public.mo_hyperfold_edges FROM anon, authenticated;

GRANT ALL ON public.songs TO service_role;
GRANT ALL ON public.fielfold_entries TO service_role;
GRANT ALL ON public.mo_traces TO service_role;
GRANT ALL ON public.life_tasks TO service_role;
GRANT ALL ON public.mo_hyperfold_edges TO service_role;
