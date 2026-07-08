// Server-side database client. Uses the service-role admin client so it can
// write to tables that revoke anon/authenticated access (mo_traces,
// fielfold_entries, songs, mo_hyperfold_edges). Never import in browser code.
export { supabaseAdmin as db } from "@/integrations/supabase/client.server";
