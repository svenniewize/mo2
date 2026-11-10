// Relational growth shared by Cadence Brain and prog-mo. No model, forecast,
// or executable text: every structural edge has observed provenance.
export type Lane = { name: string; path: string[] };
type Node = { id: string; lexeme: string | null; kind: string; heard: number; visits: number; resonance: number; fatigue: number };
type Edge = { a: string; b: string; uses: number; source: "input" | "walk" };
type Evidence = { path: string[]; evidence: number; confidence: number; tick: number; level: number };
export type GrowthState = {
  format: "mo-growth-1"; tick: number; nodes: Record<string, Node>; edges: Record<string, Edge>;
  motifs: Record<string, Evidence>; highDeep: Record<string, Evidence>; deepHigh: Record<string, Evidence>;
};
const key = (a: string, b: string) => JSON.stringify([a, b]);
const STOP = new Set("the and for with this that from are was were you your have has not but into its our they their she his can will would should".split(" "));
export function newGrowth(): GrowthState {
  return { format: "mo-growth-1", tick: 0, nodes: Object.create(null), edges: Object.create(null), motifs: Object.create(null), highDeep: Object.create(null), deepHigh: Object.create(null) };
}
export function restoreGrowth(raw: unknown): GrowthState {
  const s = raw as GrowthState | null;
  return s?.format === "mo-growth-1" && s.nodes && s.edges && s.motifs && s.highDeep && s.deepHigh ? structuredClone(s) : newGrowth();
}
function lexeme(id: string): string | null {
  const m = id.match(/^[^\p{L}\p{N}]*([\p{L}]+)[^\p{L}\p{N}]*$/u);
  const w = m?.[1]?.toLowerCase();
  return w && w.length >= 3 && !STOP.has(w) && !/(.)\1{3}/u.test(w) ? w : null;
}
function kind(id: string): string {
  if (/^[([{⟨「]/u.test(id)) return "containment";
  if (id.startsWith("`")) return "state";
  if (lexeme(id)) return /^[\p{L}]+$/u.test(id) ? "locus" : "standpoint";
  return "operator";
}
export function syntaxTokens(text: string): string[] {
  return text.match(/`+[^`]*`+|[*~]+[\p{L}\p{N}_-]+[*~]+|[\p{L}\p{N}_]+(?:[.-][\p{L}\p{N}_]+)*|[^\s]/gu) ?? [];
}
function ensure(s: GrowthState, id: string): Node {
  return s.nodes[id] ?? (s.nodes[id] = { id, lexeme: lexeme(id), kind: kind(id), heard: 0, visits: 0, resonance: 0, fatigue: 0 });
}
function record(s: GrowthState, path: string[], source: Edge["source"]) {
  for (let i = 0; i < path.length; i++) {
    const n = ensure(s, path[i]);
    if (source === "input") { n.heard++; n.resonance += 0.6; }
    else { n.visits++; n.resonance += 0.1; }
    if (i === 0) continue;
    const a = path[i - 1], b = path[i], k = key(a, b);
    const e = s.edges[k] ?? (s.edges[k] = { a, b, uses: 0, source });
    e.uses++;
  }
}
function evidence(map: Record<string, Evidence>, k: string, path: string[], tick: number, level: number) {
  const old = map[k];
  const confidence = (old?.confidence ?? 0) * Math.pow(0.98, tick - (old?.tick ?? tick));
  // Keep an actual observed member path, never splice a synthetic medoid.
  map[k] = { path: old?.path ?? [...path], evidence: (old?.evidence ?? 0) + 1, confidence: 1 - (1 - confidence) * Math.exp(-0.2), tick, level };
}
export function targetWords(input: string): number {
  return Math.max(1, Math.ceil((input.trim().match(/\S+/g)?.length ?? 0) * 1.1));
}
export function growTopology(s: GrowthState, input: string, initial: Lane[], talkytalk: boolean) {
  s.tick++;
  for (const n of Object.values(s.nodes)) { n.resonance *= 0.82; n.fatigue *= 0.82; }
  record(s, syntaxTokens(input), "input");
  const lanes = initial.filter((l) => l.path.length).map((l) => ({ name: l.name, path: [...l.path] }));
  for (const l of lanes) record(s, l.path, "walk");
  const target = targetWords(input);
  const eligible = () => new Set(lanes.flatMap((l) => l.path.map((id) => s.nodes[id]?.lexeme).filter((w): w is string => !!w)));
  let passes = 0, stagnant = 0;
  let reason = talkytalk ? "reached" : "emission";
  const adjacency = new Map<string, Edge[]>();
  for (const e of Object.values(s.edges)) adjacency.set(e.a, [...(adjacency.get(e.a) ?? []), e]);
  const reuse = new Map<string, number>();
  while (talkytalk && eligible().size < target && passes < 24 && stagnant < 3) {
    const before = eligible().size;
    const frontier = lanes.slice(-Math.max(1, initial.length));
    if (!frontier.length) break;
    const generation: Lane[] = [];
    for (let j = 0; j < frontier.length; j++) {
      const tail = frontier[j].path;
      let cur = tail[Math.max(0, tail.length - 1 - (passes % Math.min(3, tail.length)))];
      const path = [cur], seen = new Set(path);
      for (let depth = 0; depth < 48; depth++) {
        const candidates = (adjacency.get(cur) ?? []).filter((e) => !seen.has(e.b));
        candidates.sort((a, b) => {
          const score = (e: Edge) => Math.log1p(e.uses) + 1 / (1 + s.nodes[e.b].visits) - 0.8 * Math.log1p(reuse.get(key(e.a, e.b)) ?? 0);
          return score(b) - score(a) || a.b.localeCompare(b.b);
        });
        const e = candidates[0]; if (!e) break;
        reuse.set(key(e.a, e.b), (reuse.get(key(e.a, e.b)) ?? 0) + 1);
        cur = e.b; path.push(cur); seen.add(cur);
      }
      generation.push({ name: `unfold:${passes + 1}:${j + 1}`, path });
      record(s, path, "walk");
    }
    lanes.push(...generation); passes++;
    stagnant = eligible().size === before ? stagnant + 1 : 0;
  }
  if (talkytalk && eligible().size < target) reason = stagnant >= 3 ? "exhausted" : passes >= 24 ? "pass_ceiling" : "no_frontier";
  // Columns attend to actual visits; synchrony is circular phase order and
  // overlap is Jaccard, neither a semantic self-recognition measurement.
  const columns = Array.from({ length: 4 }, (_, c) => {
    const members = lanes.filter((_, i) => i % 4 === c);
    const visited = new Set(members.flatMap((l) => l.path));
    const phases = members.map((l) => l.path.length * 0.084);
    const R = phases.length ? Math.hypot(phases.reduce((n, p) => n + Math.cos(p), 0), phases.reduce((n, p) => n + Math.sin(p), 0)) / phases.length : 0;
    return { visited, members: members.length, R };
  });
  const arrivals = new Map<string, { lane: number; depth: number }[]>();
  lanes.forEach((l, lane) => {
    const seen = new Set<string>();
    l.path.forEach((id, depth) => { if (seen.has(id)) return; seen.add(id); arrivals.set(id, [...(arrivals.get(id) ?? []), { lane, depth }]); });
  });
  const convergence = [...arrivals].filter(([, a]) => a.length >= 2 && a.some((v) => v.depth > 0));
  const turnMotifs = new Set<string>();
  for (const l of lanes) {
    for (let i = 0; i + 2 < l.path.length; i += 2) {
      const span = l.path.slice(i, i + 3), shape = span.map((id) => s.nodes[id].kind).join(">");
      const k = key(shape, span.join("\u0001"));
      if (!turnMotifs.has(k)) { evidence(s.motifs, k, span, s.tick, 1); turnMotifs.add(k); }
    }
  }
  // Independent observation ledgers, run strictly after movement.
  for (const k of turnMotifs) {
    const m = s.motifs[k];
    const descriptor = m.path.map((id) => s.nodes[id].kind).join(">");
    evidence(s.highDeep, descriptor, m.path, s.tick, 1);
  }
  for (const l of lanes) for (let level = 1; level <= 3; level++) {
    const tail = l.path.slice(-3 * level);
    const descriptor = `${level}:${tail.map((id) => s.nodes[id].kind).join(">")}`;
    evidence(s.deepHigh, descriptor, tail, s.tick, level);
    if (level > 1 && tail.length >= 3) evidence(s.motifs, `composite:${descriptor}`, tail, s.tick, level);
  }
  const priority = (id: string) => {
    const n = s.nodes[id];
    return (arrivals.get(id)?.length ?? 0) * 3 + n.resonance / (1 + n.resonance) / (1 + n.fatigue);
  };
  const pending = lanes.map((l, lane) => l.path.map((id, depth) => ({ id, depth, lane })).filter((o) => s.nodes[o.id].lexeme));
  const selected: { word: string; node: string; lane: string; depth: number }[] = [], used = new Set<string>();
  while (pending.some((p) => p.length) && selected.length < target) {
    const choices = pending.map((p, lane) => ({ o: p[0], lane })).filter((v) => !!v.o);
    choices.sort((a, b) => priority(b.o.id) - priority(a.o.id) || a.lane - b.lane);
    const choice = choices[0]; if (!choice) break;
    const o = pending[choice.lane].shift(); if (!o) continue;
    const w = s.nodes[o.id].lexeme; if (!w || used.has(w)) continue;
    used.add(w); s.nodes[o.id].fatigue++;
    selected.push({ word: w, node: o.id, lane: lanes[o.lane].name, depth: o.depth });
  }
  const utterance = selected.length ? selected.map((o) => o.word).reduce<string[]>((lines, w, i) => {
    if (i % 14 === 0) lines.push(w); else lines[lines.length - 1] += ` ${w}`;
    return lines;
  }, []).join(".\n") + "." : "(structural activity only — no eligible word visited)";
  const steps = lanes.reduce((n, l) => n + Math.max(0, l.path.length - 1), 0);
  const transitions = new Set(lanes.flatMap((l) => l.path.slice(1).map((b, i) => key(l.path[i], b))));
  const telemetry = [
    `[GROWTH] tick=${s.tick} nodes=${Object.keys(s.nodes).length} edges=${Object.keys(s.edges).length} motifs=${Object.keys(s.motifs).length}`,
    `[AMPLIFY] target=${target} eligible=${eligible().size} selected=${selected.length} passes=${passes} shortfall=${Math.max(0, target - selected.length)} reason=${reason}`,
    `[MOVEMENT] steps=${steps} unique_nodes=${arrivals.size} transitions=${transitions.size} repeated=${steps - transitions.size}`,
    `[COLUMNS] ${columns.map((c, i) => `${i + 1}:members=${c.members},nodes=${c.visited.size},R=${c.R.toFixed(3)}`).join(" | ")}`,
    `[OVERLAP] ${columns.flatMap((a, i) => columns.slice(i + 1).map((b, j) => `${i + 1}/${i + j + 2}=${([...a.visited].filter((v) => b.visited.has(v)).length / Math.max(1, new Set([...a.visited, ...b.visited]).size)).toFixed(3)}`)).join(" ")}`,
    `[LEDGERS] high→deep=${Object.keys(s.highDeep).length} deep→high=${Object.keys(s.deepHigh).length} coupled=false affects_movement=false self_model=false`,
    ...convergence.map(([id, a]) => `[CONVERGENCE] ${JSON.stringify(id)} arrivals=${a.map((v) => `${lanes[v.lane].name}@${v.depth}`).join(",")} score=${(a.length / Math.max(1, lanes.length)).toFixed(3)}`),
    ...selected.map((o) => `[WORD] ${o.word} node=${JSON.stringify(o.node)} walker=${o.lane} depth=${o.depth}`),
    ...lanes.map((l) => `[FOLD ${l.name}] ${l.path.join(" → ")}`),
  ].join("\n");
  return { utterance, lanes, selected, telemetry, target, reason };
}