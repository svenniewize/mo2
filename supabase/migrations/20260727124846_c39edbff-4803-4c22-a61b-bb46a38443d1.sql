
REVOKE EXECUTE ON FUNCTION public.prog_mo_hyperfold_bump(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prog_mo_crystal_bump(text, text, text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prog_mo_hyperfold_bump(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.prog_mo_crystal_bump(text, text, text[], text) TO service_role;
