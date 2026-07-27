// CPS-0 — the hyperfold operator.
//
// CPS-0 is not just another manifold in prog-mo's terrain. Its grammar
// (SOURCE;OP:TARGET::PAYLOAD) is parsed out of the user's input and used
// to *program* every other operator: walker options are mutated per
// statement, and directed sediment is written on the SOURCE→TARGET edge.
//
// The four operators map to distinct cognitive pressures:
//   to    — outward emission        → aw↑ temp↓         (directed thought)
//   seen  — perceptual delta        → dw↑ jitter↑       (density noticing)
//   orio  — memory resonance        → cw↑ jitter↑       (link to stable prior)
//   from  — reflective incoming     → cw↓ temp↑ start=peripheral
//
// If a TARGET is a real vocab word it becomes an additional anchor.
// PAYLOAD tokens are folded into the seed set. The CPS-0 walker walks
// from every SOURCE with the compiled option set. This is what "programs
// the field" means: the grammar rewires the walkers before they run.

export type CpsOp = "to" | "seen" | "orio" | "from";
export type CpsStmt = { source: string; op: CpsOp; target: string; payload: string; tokens: string[] };

const OP_RX = /([a-z_][\w-]*)\s*;\s*(to|seen|orio|from)\s*:\s*([a-z_][\w-]*)\s*::\s*(.*)/gi;

export function parseCps(input: string): CpsStmt[] {
  const out: CpsStmt[] = [];
  const lines = input.split(/\r?\n/);
  for (const line of lines) {
    OP_RX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = OP_RX.exec(line)) !== null) {
      const payload = (m[4] || "").trim();
      const tokens = payload.toLowerCase().replace(/[^a-z0-9\s_.-]/g, " ").split(/\s+/).filter((w) => w.length >= 2);
      out.push({
        source: m[1].toLowerCase(),
        op: m[2].toLowerCase() as CpsOp,
        target: m[3].toLowerCase(),
        payload,
        tokens,
      });
    }
  }
  return out;
}

// A compiled CPS-0 "program": the aggregate mutation the parsed statements
// impose on the walker fleet, plus the extra seeds/anchors/directed edges
// that get injected into the breath.
export type CpsProgram = {
  stmts: CpsStmt[];
  // per-op tallies used to mutate every walker's opts
  mut: { cw: number; dw: number; aw: number; temp: number; jitter: number; startBias: "anchor" | "peripheral" | null };
  extraSeeds: string[];    // payload tokens fold into seeds
  extraAnchors: string[];  // sources+targets fold into anchors
  directed: { a: string; b: string; w: number }[]; // hyperfold writes (SOURCE→TARGET, TARGET→PAYLOAD*)
};

export function compileCps(stmts: CpsStmt[]): CpsProgram {
  const mut = { cw: 0, dw: 0, aw: 0, temp: 0, jitter: 0, startBias: null as "anchor" | "peripheral" | null };
  const extraSeeds = new Set<string>();
  const extraAnchors = new Set<string>();
  const directed: { a: string; b: string; w: number }[] = [];
  const CPS_LR = 0.24; // directed sediment is heavier than passive coabundance

  for (const s of stmts) {
    extraAnchors.add(s.source);
    extraAnchors.add(s.target);
    for (const t of s.tokens) extraSeeds.add(t);

    switch (s.op) {
      case "to":
        mut.aw += 0.6; mut.temp -= 0.15; mut.startBias = "anchor";
        directed.push({ a: s.source, b: s.target, w: CPS_LR });
        break;
      case "seen":
        mut.dw += 0.7; mut.jitter += 0.2;
        directed.push({ a: s.target, b: s.source, w: CPS_LR * 0.6 });
        break;
      case "orio":
        mut.cw += 0.8; mut.jitter += 0.3;
        directed.push({ a: s.source, b: s.target, w: CPS_LR * 0.8 });
        directed.push({ a: s.target, b: s.source, w: CPS_LR * 0.8 });
        break;
      case "from":
        mut.cw -= 0.2; mut.temp += 0.3; mut.startBias = "peripheral";
        directed.push({ a: s.target, b: s.source, w: CPS_LR });
        break;
    }
    // Payload tokens land as directed edges from TARGET into the payload —
    // the payload is what the cognitive pressure is *carrying* into target.
    for (const t of s.tokens) directed.push({ a: s.target, b: t, w: CPS_LR * 0.5 });
  }

  // clamp
  mut.cw = Math.max(-1, Math.min(3, mut.cw));
  mut.dw = Math.max(-1, Math.min(3, mut.dw));
  mut.aw = Math.max(-1, Math.min(3, mut.aw));
  mut.temp = Math.max(-1, Math.min(1, mut.temp));
  mut.jitter = Math.max(-0.5, Math.min(1, mut.jitter));

  return { stmts, mut, extraSeeds: [...extraSeeds], extraAnchors: [...extraAnchors], directed };
}

export function renderCpsTelemetry(p: CpsProgram): string {
  if (!p.stmts.length) return "";
  const lines: string[] = [];
  lines.push(`── cps-0 · hyperfold operator (${p.stmts.length} stmts parsed) ──`);
  for (const s of p.stmts.slice(0, 8)) {
    lines.push(`  ⌘ ${s.source};${s.op}:${s.target}:: ${s.payload.slice(0, 60)}`);
  }
  const m = p.mut;
  lines.push(`  ↳ mutation:  cw+=${m.cw.toFixed(2)}  dw+=${m.dw.toFixed(2)}  aw+=${m.aw.toFixed(2)}  temp+=${m.temp.toFixed(2)}  jitter+=${m.jitter.toFixed(2)}  start=${m.startBias ?? "—"}`);
  lines.push(`  ↳ directed edges written: ${p.directed.length}   extra anchors: ${p.extraAnchors.length}   payload seeds: ${p.extraSeeds.length}`);
  return lines.join("\n");
}
