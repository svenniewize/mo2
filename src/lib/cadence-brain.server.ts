import type { MoBreath } from "./mo-engine.server";
import { growTopology, restoreGrowth, type Lane } from "./structural-growth";
import { loadGrowth, saveGrowth } from "./structural-growth.server";

// An additive Cadence branch, not a replacement for the trainable council.
export async function cadenceBrain(input: string, breath: MoBreath, session: string, watch: "mo" | "anansi", talkytalk: boolean, temporary: boolean, rawState?: unknown) {
  const state = temporary ? restoreGrowth(rawState) : await loadGrowth(`${session}::brain`);
  const lanes: Lane[] = [
    { name: "selffold", path: breath.selffold.path }, { name: "fieldfold", path: breath.fieldfold.path },
    ...Object.entries(breath.variants).flatMap(([name, v]) => [
      { name: `${name}:dream`, path: v.dreamPath }, { name: `${name}:return`, path: v.returnPath },
    ]),
  ];
  // Shape view changes strand processing order, never fabricates a path.
  if (watch === "anansi") lanes.sort((a, b) => b.path.length - a.path.length || a.name.localeCompare(b.name));
  const result = growTopology(state, input, lanes, talkytalk);
  if (!temporary) await saveGrowth(`${session}::brain`, state);
  const emission = lanes.map((l) => `${l.name}:: ${l.path.join(" → ")}`).join("\n");
  return {
    reply: talkytalk ? result.utterance : emission || "(no traversal yet)",
    telemetry: `[ENGINE] CADENCE BRAIN · ${watch}·watch · talkytalk=${talkytalk} · self_model=false · next_token_predictor=false\n${result.telemetry}\n[ORIGINAL EMISSION]\n${emission}`,
    brainState: temporary ? state : undefined,
  };
}