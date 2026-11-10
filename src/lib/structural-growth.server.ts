import { db } from "./db.server";
import { newGrowth, restoreGrowth, type GrowthState } from "./structural-growth";
import type { Json } from "@/integrations/supabase/types";

export async function loadGrowth(session: string): Promise<GrowthState> {
  const { data, error } = await db.from("cadence_state").select("state").eq("session_id", session).maybeSingle();
  if (error) throw new Error("Structural memory could not be read");
  return data ? restoreGrowth(data.state) : newGrowth();
}
export async function saveGrowth(session: string, state: GrowthState) {
  const { error } = await db.from("cadence_state").upsert({
    session_id: session, state: state as unknown as Json, steps: state.tick,
    vocab_size: Object.keys(state.nodes).length, loss: 0, updated_at: new Date().toISOString(),
  }, { onConflict: "session_id" });
  if (error) throw new Error("Structural memory could not be saved");
}