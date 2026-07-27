// prog-mo — a full clone of mo, walking a programming-language semantic terrain.
//
// Four cycles per breath:
//   1) prog-mo:d       — decompose input into per-language compile-pressure
//   2) walkers         — 7 competing hypotheses walk the graph, each producing
//                        a resonance waveform
//   3) return          — reversed-golden-ratio traversal home, gravitational
//                        pull toward the beginning of the walk
//   4) synthesis       — mixed anansi/mohini/mimic pass over the walks,
//                        crystallizing recurring motifs. THIS is the reply.
//
// The topology is: base mo manifolds + PROG_MANIFOLDS + any uploaded
// prog_mo_manifolds. Sedimentation is namespaced to prog_mo_hyperfold_edges,
// so prog-mo learns without polluting main mo — UNLESS the caller passes
// blendIntoMo=true, in which case sediment is also fed to mo's hyperfold.

import { MANIFOLDS } from "./corpora";
import { PROG_MANIFOLDS, type ProgManifold } from "./prog-manifolds";

const STOP = new Set("the a an is are was were be been being have has had do does did will would could should may might shall can to of in for on with at by from as into through during before after above below between out off over under again further then once here there when where why how all both each few more most other some such no nor not only own same so than too very just because but and or if while about up its it he she they them his her their what which who whom this that these those i me my we our you your us also said one two even way like new now get make many much still well back down long made first last come good know take see look find give tell think say help every try put thing since around however upon already yet though without".split(" "));

function tokenize(t: string): string[] {
  return t.toLowerCase().replace(/[^a-z0-9\s_.-]/g, " ").split(/\s+/).filter((w) => w && w.length >= 2 && !STOP.has(w));
}

type Topology = {
  ppmi: Record<string, Record<string, number>>;
  density: Record<string, number>;
  centrality: Record<string, number>;
  wordToManifold: Record<string, Record<string, number>>;
  vocab: string[];
};

let TOPO: Topology | null = null;
let TOPO_KEY = "";

// hyperfold overlay (prog-mo scoped)
const HF: Record<string, Record<string, number>> = {};
const HFD: Record<string, number> = {};
let HF_LOADED: Promise<void> | null = null;
let MO_HF_LOADED: Promise<void> | null = null;
const HF_ALPHA = 0.6;
const LR = 0.08;
const WINDOW = 5;

async function ensureHyperfold() {
  if (HF_LOADED) return HF_LOADED;
  HF_LOADED = (async () => {
    try {
      const { db } = await import("./db.server");
      const { data } = await db.from("prog_mo_hyperfold_edges").select("word_a,word_b,weight").order("weight", { ascending: false }).limit(20000);
      for (const r of (data ?? []) as { word_a: string; word_b: string; weight: number }[]) {
        (HF[r.word_a] ||= {})[r.word_b] = r.weight;
        HFD[r.word_a] = (HFD[r.word_a] || 0) + r.weight;
      }
    } catch {}
  })();
  return HF_LOADED;
}

// v2: clone the main mo hyperfold sediment (all tricksterkekeke etc.)
// on top of prog-mo's own overlay. Additive, one-time load.
async function ensureMoHyperfoldClone() {
  if (MO_HF_LOADED) return MO_HF_LOADED;
  MO_HF_LOADED = (async () => {
    try {
      const { db } = await import("./db.server");
      const { data } = await db.from("mo_hyperfold_edges").select("word_a,word_b,weight").order("weight", { ascending: false }).limit(20000);
      for (const r of (data ?? []) as { word_a: string; word_b: string; weight: number }[]) {
        (HF[r.word_a] ||= {})[r.word_b] = (HF[r.word_a][r.word_b] || 0) + r.weight;
        HFD[r.word_a] = (HFD[r.word_a] || 0) + r.weight;
      }
    } catch {}
  })();
  return MO_HF_LOADED;
}


function neighbors(t: Topology, w: string): Record<string, number> {
  const base = t.ppmi[w];
  const over = HF[w];
  if (!over) return base || {};
  const out: Record<string, number> = base ? { ...base } : {};
  for (const u of Object.keys(over)) out[u] = (out[u] || 0) + HF_ALPHA * over[u];
  return out;
}
function densityOf(t: Topology, w: string): number { return (t.density[w] || 0) + HF_ALPHA * (HFD[w] || 0); }
function has(t: Topology, w: string): boolean { return !!t.ppmi[w] || !!HF[w]; }

function buildTopology(extra: ProgManifold[]): Topology {
  const docs: { id: string; text: string }[] = [
    ...MANIFOLDS.map((m) => ({ id: m.id, text: m.text })),
    ...PROG_MANIFOLDS.map((m) => ({ id: m.id, text: m.text })),
    ...extra.map((m) => ({ id: m.id, text: m.text })),
  ];
  const co: Record<string, Record<string, number>> = {};
  const wordToManifold: Record<string, Record<string, number>> = {};
  const W = 5;
  for (const d of docs) {
    const toks = tokenize(d.text);
    for (let i = 0; i < toks.length; i++) {
      const w = toks[i];
      (wordToManifold[w] ||= {})[d.id] = (wordToManifold[w]?.[d.id] || 0) + 1;
      co[w] ||= {};
      for (let j = Math.max(0, i - W); j <= Math.min(toks.length - 1, i + W); j++) {
        if (i === j) continue;
        const dist = Math.abs(i - j);
        co[w][toks[j]] = (co[w][toks[j]] || 0) + 1 / dist;
      }
    }
  }
  let total = 0;
  for (const w of Object.keys(co)) for (const u of Object.keys(co[w])) total += co[w][u];
  const wt: Record<string, number> = {};
  for (const w of Object.keys(co)) wt[w] = Object.values(co[w]).reduce((a, b) => a + b, 0);
  const ppmi: Record<string, Record<string, number>> = {};
  const density: Record<string, number> = {};
  for (const w of Object.keys(co)) {
    ppmi[w] = {};
    for (const u of Object.keys(co[w])) {
      const p = (co[w][u] * total) / (wt[w] * wt[u] || 1);
      const v = Math.log2(p);
      if (v > 0) { ppmi[w][u] = v; density[w] = (density[w] || 0) + v; }
    }
  }
  const vocab = Object.keys(ppmi);
  let cent: Record<string, number> = {};
  for (const w of vocab) cent[w] = 1;
  for (let iter = 0; iter < 8; iter++) {
    const next: Record<string, number> = {};
    for (const w of vocab) {
      let s = 0;
      for (const u of Object.keys(ppmi[w])) s += (cent[u] || 0) * ppmi[w][u];
      next[w] = 0.15 + 0.85 * s;
    }
    let mx = 0; for (const w of vocab) if (next[w] > mx) mx = next[w];
    if (mx > 0) for (const w of vocab) next[w] /= mx;
    cent = next;
  }
  return { ppmi, density, centrality: cent, wordToManifold, vocab };
}

async function topo(): Promise<Topology> {
  let uploaded: ProgManifold[] = [];
  try {
    const { db } = await import("./db.server");
    const { data } = await db.from("prog_mo_manifolds").select("slug,name,sigil,color,breath,text").limit(200);
    uploaded = ((data ?? []) as any[]).map((r) => ({ id: `up:${r.slug}`, name: r.name, sigil: r.sigil, color: r.color, breath: r.breath, text: r.text }));
  } catch {}
  const key = uploaded.map((u) => u.id).sort().join(",");
  if (!TOPO || key !== TOPO_KEY) { TOPO = buildTopology(uploaded); TOPO_KEY = key; }
  return TOPO;
}

// —————————— CYCLE 1: prog-mo:d — semantic architecture decomposition
export type CompilePressure = { manifold: string; name: string; sigil: string; color: string; score: number; hits: string[]; kind: "operator" | "terrain" }[];

function manifoldCatalog(): Record<string, { name: string; sigil: string; color: string; kind: "operator" | "terrain" }> {
  const cat: Record<string, { name: string; sigil: string; color: string; kind: "operator" | "terrain" }> = {};
  for (const m of PROG_MANIFOLDS) cat[m.id] = { name: m.name, sigil: m.sigil, color: m.color, kind: "operator" };
  for (const m of MANIFOLDS) cat[m.id] = { name: m.name || m.id, sigil: (m as any).sigil || "◈", color: (m as any).color || "#7DE2D1", kind: "terrain" };
  return cat;
}

function compilePressure(t: Topology, seeds: string[], v2: boolean): CompilePressure {
  const cat = manifoldCatalog();
  // v1: prog manifolds only. v2: prog (operator) + mo (terrain) + uploaded.
  const allow = new Set<string>();
  for (const m of PROG_MANIFOLDS) allow.add(m.id);
  if (v2) {
    for (const m of MANIFOLDS) allow.add(m.id);
  }
  // uploaded manifolds always count
  for (const w of Object.keys(t.wordToManifold)) for (const id of Object.keys(t.wordToManifold[w] || {})) if (id.startsWith("up:")) allow.add(id);

  const scores: Record<string, number> = {};
  const hits: Record<string, string[]> = {};
  for (const s of seeds) {
    const mm = t.wordToManifold[s] || {};
    for (const id of Object.keys(mm)) {
      if (!allow.has(id)) continue;
      scores[id] = (scores[id] || 0) + mm[id];
      (hits[id] ||= []).push(s);
    }
  }
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(scores)
    .map(([id, s]) => ({
      manifold: id,
      name: cat[id]?.name || id.replace(/^up:/, ""),
      sigil: cat[id]?.sigil || "◈",
      color: cat[id]?.color || "#7DE2D1",
      kind: cat[id]?.kind || (id.startsWith("up:") ? "terrain" : "operator"),
      score: Math.round((s / total) * 100),
      hits: Array.from(new Set(hits[id])).slice(0, 8),
    }))
    .sort((a, b) => b.score - a.score);
}

// Auto-categorize walked words not yet mapped to any manifold: assign them
// to the strongest manifold among their PPMI neighbors' owners. In-memory,
// so future breaths in this worker see them classified.
function autoCategorize(t: Topology, words: string[]): number {
  let n = 0;
  for (const w of words) {
    if (!w) continue;
    if (t.wordToManifold[w] && Object.keys(t.wordToManifold[w]).length) continue;
    const nb = t.ppmi[w] || {};
    const tally: Record<string, number> = {};
    for (const u of Object.keys(nb)) {
      const owners = t.wordToManifold[u]; if (!owners) continue;
      for (const id of Object.keys(owners)) tally[id] = (tally[id] || 0) + nb[u] * owners[id];
    }
    const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0) {
      (t.wordToManifold[w] ||= {})[best[0]] = 1;
      n++;
    }
  }
  return n;
}


// —————————— CYCLE 2: competing walkers
type Walker = { name: string; question: string; path: string[]; resonance: number[]; anchors: string[] };

function sample<T>(cands: [T, number][], temp = 1): T | undefined {
  if (!cands.length) return;
  const scores = cands.map(([, s]) => Math.pow(Math.max(s, 1e-6), 1 / temp));
  const sum = scores.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < cands.length; i++) { r -= scores[i]; if (r <= 0) return cands[i][0]; }
  return cands[cands.length - 1][0];
}

type WalkOpts = { cw?: number; dw?: number; aw?: number; temp?: number; jitter?: number; avoid?: Set<string>; anchors?: Set<string> };

function walk(t: Topology, start: string, act: Record<string, number>, depth: number, o: WalkOpts = {}): { path: string[]; resonance: number[] } {
  const path: string[] = []; const used = o.avoid ? new Set(o.avoid) : new Set<string>();
  const res: number[] = [];
  let cur = start;
  const cw = o.cw ?? 1, dw = o.dw ?? 1, aw = o.aw ?? 1, temp = o.temp ?? 1, jit = o.jitter ?? 0.6;
  for (let i = 0; i < depth; i++) {
    if (!cur || !has(t, cur)) break;
    path.push(cur); used.add(cur);
    // resonance = alignment of cur with anchors via PPMI
    let r = 0;
    if (o.anchors) for (const a of o.anchors) if (t.ppmi[cur]?.[a]) r = Math.max(r, t.ppmi[cur][a]);
    res.push(Math.round(Math.tanh(r / 3) * 100));
    const nb = neighbors(t, cur);
    const cands: [string, number][] = [];
    for (const u of Object.keys(nb)) {
      if (used.has(u)) continue;
      const sc = nb[u] * (1 + cw * (t.centrality[u] || 0)) * (1 + dw * (densityOf(t, u) / 100)) * (1 + aw * (act[u] || 0)) * (1 - jit / 2 + Math.random() * jit);
      cands.push([u, sc]);
    }
    cands.sort((a, b) => b[1] - a[1]);
    cur = sample(cands.slice(0, 12), temp) || "";
  }
  return { path, resonance: res };
}

function inject(t: Topology, seeds: string[]): Record<string, number> {
  const act: Record<string, number> = {};
  for (const s of seeds) {
    if (!has(t, s)) continue;
    act[s] = (act[s] || 0) + 1;
    const nb = neighbors(t, s);
    for (const u of Object.keys(nb)) act[u] = (act[u] || 0) + nb[u] * 0.3;
  }
  return act;
}

function runWalkers(t: Topology, seeds: string[], stretch: number): Walker[] {
  const anch = seeds.filter((s) => has(t, s));
  if (!anch.length) return [];
  const act = inject(t, anch);
  const anchorSet = new Set(anch);
  const depth = Math.max(10, Math.min(60, 12 + seeds.length)) * Math.max(1, stretch);
  const start = anch[0];
  const startAlt = anch[Math.min(anch.length - 1, Math.floor(anch.length / 2))];
  const peak = Object.entries(act).sort((a, b) => b[1] - a[1])[0]?.[0] || start;
  const peripheral = Object.entries(act).sort((a, b) => a[1] - b[1])[0]?.[0] || start;
  const random = anch[Math.floor(Math.random() * anch.length)];

  const wcs: { name: string; question: string; start: string; opts: WalkOpts }[] = [
    { name: "greedy",    question: "what is the obvious implementation?",  start, opts: { cw: 0.8, dw: 0.4, aw: 1.8, temp: 0.6, jitter: 0.2, anchors: anchorSet } },
    { name: "drift",     question: "what similar solutions exist?",        start: random, opts: { cw: 0.4, dw: 0.6, aw: 0.9, temp: 1.4, jitter: 0.9, anchors: anchorSet } },
    { name: "dense",     question: "what architecture fits?",              start: peak, opts: { cw: 0.5, dw: 2.2, aw: 0.6, temp: 0.9, jitter: 0.4, anchors: anchorSet } },
    { name: "peak",      question: "the most stable abstraction?",         start: peak, opts: { cw: 2.0, dw: 0.6, aw: 0.5, temp: 0.7, jitter: 0.3, anchors: anchorSet } },
    { name: "anansi",    question: "how does this connect elsewhere?",     start: peripheral, opts: { cw: 0.6, dw: 0.4, aw: 0.4, temp: 1.2, jitter: 0.8, anchors: anchorSet } },
    { name: "smash",     question: "what if the assumption is wrong?",     start: startAlt, opts: { cw: 0.2, dw: -0.5, aw: 0.3, temp: 1.6, jitter: 1.1, anchors: anchorSet } },
    { name: "dimhopper", question: "can this become another paradigm?",    start: peripheral, opts: { cw: 0.8, dw: 0.8, aw: 0.3, temp: 1.5, jitter: 0.9, anchors: anchorSet } },
  ];
  return wcs.map((w) => {
    const r = walk(t, w.start, act, depth, w.opts);
    return { name: w.name, question: w.question, path: r.path, resonance: r.resonance, anchors: anch.slice(0, 6) };
  });
}

// —————————— CYCLE 3: return — reversed golden ratio
const PHI = 1.61803398875;

function returnWalk(t: Topology, walkers: Walker[], anch: string[]): { path: string[]; steps: number[]; ratio: number } {
  if (!walkers.length || !anch.length) return { path: [], steps: [], ratio: 1 / PHI };
  const combined = walkers.flatMap((w) => w.path);
  if (!combined.length) return { path: [], steps: [], ratio: 1 / PHI };
  // gravity: heavy activation on anchors (the beginning of the walk)
  const backAct: Record<string, number> = {};
  for (const a of anch) backAct[a] = 5;
  // reversed golden ratio step lengths: start large, shrink by /φ each hop
  const total = combined.length;
  const steps: number[] = [];
  let remaining = total;
  let step = Math.max(3, Math.floor(total * (1 / PHI)));
  while (remaining > 1 && steps.length < 8) {
    step = Math.max(1, Math.floor(step / PHI));
    if (step < 1) step = 1;
    steps.push(step);
    remaining -= step;
  }
  const path: string[] = [];
  const used = new Set<string>();
  let cur = combined[combined.length - 1];
  for (const s of steps) {
    const seg = walk(t, cur, backAct, s + 2, { cw: 0.5, dw: 0.3, aw: 3, temp: 0.8, jitter: 0.4, avoid: used, anchors: new Set(anch) });
    for (const w of seg.path) used.add(w);
    path.push(...seg.path);
    cur = seg.path[seg.path.length - 1] || cur;
    if (anch.includes(cur)) break; // reached home
  }
  return { path, steps, ratio: 1 / PHI };
}

// —————————— CYCLE 4: synthesis + crystals
type Synthesis = { reply: string; crystals: { signature: string; pattern: string[]; kind: string }[] };

function findCrystals(walkers: Walker[]): { signature: string; pattern: string[]; kind: string }[] {
  // A crystal = a repeated motif across walker paths.
  //   trigram appearing in ≥2 walkers   → "trigram"
  //   bigram  appearing in ≥3 walkers   → "bigram"
  // Restrained enough not to fire on every breath, permissive enough to
  // catch actual resonance.
  const tri: Record<string, { pattern: string[]; count: number }> = {};
  const bi: Record<string, { pattern: string[]; count: number }> = {};
  for (const w of walkers) {
    const triSeen = new Set<string>();
    const biSeen = new Set<string>();
    for (let i = 0; i < w.path.length - 1; i++) {
      const b = [w.path[i], w.path[i + 1]];
      const bk = b.join("·");
      if (!biSeen.has(bk)) { biSeen.add(bk); (bi[bk] ||= { pattern: b, count: 0 }).count++; }
      if (i < w.path.length - 2) {
        const t3 = [w.path[i], w.path[i + 1], w.path[i + 2]];
        const tk = t3.join("·");
        if (!triSeen.has(tk)) { triSeen.add(tk); (tri[tk] ||= { pattern: t3, count: 0 }).count++; }
      }
    }
  }
  const out: { signature: string; pattern: string[]; kind: string }[] = [];
  for (const [k, v] of Object.entries(tri)) if (v.count >= 2) out.push({ signature: k, pattern: v.pattern, kind: "trigram" });
  for (const [k, v] of Object.entries(bi))  if (v.count >= 3) out.push({ signature: `bi:${k}`, pattern: v.pattern, kind: "bigram" });
  return out.slice(0, 16);
}

// Pull the top-N PPMI/hyperfold neighbours across a set of anchor words —
// used to *fill in* problem/constraints/abstractions/etc. lines so that on
// higher stretch the corpus itself extends the ponder.
function expandFromCorpus(t: Topology, anchors: string[], n: number, avoid: Set<string>): string[] {
  const tally: Record<string, number> = {};
  for (const a of anchors) {
    const nb = neighbors(t, a);
    for (const u of Object.keys(nb)) {
      if (avoid.has(u)) continue;
      tally[u] = (tally[u] || 0) + nb[u] * (1 + (t.centrality[u] || 0));
    }
  }
  return Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]);
}

// Fill `base` up to `target` words by pulling extensions from the corpus.
function fillLine(t: Topology, base: string[], target: number): string[] {
  if (base.length >= target) return base.slice(0, target);
  const need = target - base.length;
  const avoid = new Set(base);
  const extra = expandFromCorpus(t, base.length ? base : Object.keys(t.centrality).slice(0, 3), need, avoid);
  return [...base, ...extra];
}

function synthesize(t: Topology, walkers: Walker[], ret: { path: string[]; steps: number[] }, anch: string[], pressure: CompilePressure, stretch: number): Synthesis {
  const crystals = findCrystals(walkers);
  const s = Math.max(1, Math.min(5, stretch));

  // anansi-style bucketing over combined tokens
  const combined: string[] = [...anch];
  for (const w of walkers) combined.push(...w.path.slice(0, 10 * s));
  combined.push(...ret.path);

  const freq: Record<string, number> = {};
  for (const w of combined) freq[w] = (freq[w] || 0) + 1;
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const nexus = sorted.slice(0, 3).map((x) => x[0]);
  const singularity = sorted.slice(-3).map((x) => x[0]);

  // ── stretch-scaled line widths. On 1x the lines stay tight; on 5x the
  // corpus itself extends every non-synthesis line to ponder outward.
  const w1 = 3 + s * 2;   // problem
  const w2 = 3 + s * 2;   // constraints
  const w3 = 3 + s * 2;   // abstractions
  const wp = 4 + s * 3;   // candidate/alternative path length
  const wl = 5 + s * 3;   // periphery / lure count
  const wm = 2 + s;       // mirror pairs

  const problem       = fillLine(t, anch.slice(0, 5), w1);
  const constraints   = fillLine(t, anch.slice(0, 3), w2);
  const abstractions  = fillLine(t, nexus, w3);
  const candidate     = fillLine(t, walkers[0]?.path.slice(0, 4) || [], wp);
  const alternative   = walkers[1] ? fillLine(t, walkers[1].path.slice(0, 4), wp) : [];
  const periphery     = fillLine(t, singularity, wl);
  const lureBase      = walkers.flatMap((w) => w.path.slice(0, 2)).slice(0, 5);
  const lure          = fillLine(t, lureBase, wl);
  const mirrorPairs   = fillLine(t, anch.slice(0, 2), wm);

  // mimic-style bigram chain — already stretch-scaled
  const bigrams: Record<string, string[]> = {};
  for (let i = 0; i < combined.length - 1; i++) (bigrams[combined[i]] ||= []).push(combined[i + 1]);
  const chainLen = 12 + 6 * s;
  const chain: string[] = [nexus[0] || combined[0]];
  for (let i = 0; i < chainLen && chain[chain.length - 1]; i++) {
    const next = bigrams[chain[chain.length - 1]];
    if (!next || !next.length) break;
    chain.push(next[Math.floor(Math.random() * next.length)]);
  }

  // top pressure line — operators (prog) and terrain (mo) separated
  const operators = pressure.filter((p) => p.kind === "operator").slice(0, 3);
  const terrain   = pressure.filter((p) => p.kind === "terrain").slice(0, 3);
  const opLine  = operators.map((p) => `${p.sigil} ${p.name} ${p.score}%`).join("  ");
  const trLine  = terrain.map((p)   => `${p.sigil} ${p.name} ${p.score}%`).join("  ");

  const arch = [
    opLine  ? `⟪ operator  ⟫ ${opLine}` : "",
    trLine  ? `⟪ terrain   ⟫ ${trLine}` : "",
    `⟢ problem       ⇢ ${problem.join(" · ")}`,
    `⇢ constraints   ⋄ ${constraints.join(" · ") || "—"}`,
    `☬ abstractions  ◈ ${abstractions.join(" · ") || "—"}`,
    `∴ candidate     ↺ ${candidate.join(" → ") || "—"}`,
    alternative.length ? `∴ alternative   ↺ ${alternative.join(" → ")}` : "",
    `≋ synthesis     ~ ${chain.join(" ~ ")}`,
    `⌇ periphery     ⌇ ${periphery.join(" ⌇ ") || "—"}`,
    crystals.length ? `❄ crystals      ${crystals.slice(0, 5).map((c) => c.pattern.join("·")).join("   ")}` : "",
    mirrorPairs.length ? `☾ mirror        ${mirrorPairs.map((w) => `${w}, ${w}`).join(" · ")}` : "",
    lure.length ? `✦ lure          ${lure.map((w) => `${w}.`).join(" ")}` : "",
    `↩ return(1/φ=${(1/PHI).toFixed(3)}) ${ret.path.slice(0, 12).join(" ← ") || "—"}`,
  ].filter(Boolean).join("\n");

  return { reply: arch, crystals };
}


// —————————— Sediment
export function sedimentProg(tokens: string[], blendIntoMo: boolean): void {
  if (!tokens.length) return;
  const deltas: Record<string, Record<string, number>> = {};
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i]; if (!a) continue;
    for (let j = Math.max(0, i - WINDOW); j <= Math.min(tokens.length - 1, i + WINDOW); j++) {
      if (i === j) continue;
      const b = tokens[j]; if (!b) continue;
      const w = LR / Math.abs(i - j);
      (deltas[a] ||= {})[b] = (deltas[a]?.[b] || 0) + w;
    }
  }
  const flat: { a: string; b: string; w: number }[] = [];
  for (const a of Object.keys(deltas)) for (const b of Object.keys(deltas[a])) {
    const dw = deltas[a][b];
    (HF[a] ||= {})[b] = (HF[a][b] || 0) + dw;
    HFD[a] = (HFD[a] || 0) + dw;
    flat.push({ a, b, w: dw });
  }
  if (!flat.length) return;
  (async () => {
    try {
      const { db } = await import("./db.server");
      for (let i = 0; i < flat.length; i += 500) await db.rpc("prog_mo_hyperfold_bump", { edges: flat.slice(i, i + 500) });
    } catch {}
  })();
  if (blendIntoMo) {
    (async () => {
      try {
        const { sediment } = await import("./mo-engine.server");
        sediment(tokens);
      } catch {}
    })();
  }
}

async function persistCrystals(sessionId: string, crystals: { signature: string; pattern: string[]; kind: string }[]) {
  if (!crystals.length) return;
  try {
    const { db } = await import("./db.server");
    for (const c of crystals) await db.rpc("prog_mo_crystal_bump", { sid: sessionId, sig: c.signature, pat: c.pattern, k: c.kind });
  } catch {}
}

// —————————— Public breath
export type ProgBreath = {
  seeds: string[];
  cycle1_pressure: CompilePressure;
  cycle2_walkers: Walker[];
  cycle3_return: { path: string[]; steps: number[]; ratio: number };
  cycle4_reply: string;
  crystals: { signature: string; pattern: string[]; kind: string }[];
  telemetry: string;
  hyperfold: { nodes: number; edges: number };
};

function hfStats() {
  let edges = 0;
  for (const a of Object.keys(HF)) edges += Object.keys(HF[a]).length;
  return { nodes: Object.keys(HF).length, edges };
}

export async function progMoBreathe(input: string, sessionId: string, stretch: number = 1, blendIntoMo: boolean = false): Promise<ProgBreath> {
  await ensureHyperfold();
  const t = await topo();
  const seeds = tokenize(input);
  const anch = seeds.filter((s) => has(t, s));

  // Cycle 1
  const pressure = compilePressure(t, seeds);
  // Cycle 2
  const walkers = runWalkers(t, seeds, stretch);
  // Cycle 3
  const ret = returnWalk(t, walkers, anch);
  // Cycle 4
  const { reply, crystals } = synthesize(walkers, ret, anch, pressure, stretch);

  // Sediment: input + every walker's path + return
  sedimentProg(seeds, blendIntoMo);
  for (const w of walkers) sedimentProg(w.path, blendIntoMo);
  sedimentProg(ret.path, blendIntoMo);
  void persistCrystals(sessionId, crystals);

  const stats = hfStats();
  const telemetry = renderTelemetry({ seeds, anch, pressure, walkers, ret, crystals, stats, stretch, blend: blendIntoMo });

  return { seeds, cycle1_pressure: pressure, cycle2_walkers: walkers, cycle3_return: ret, cycle4_reply: reply, crystals, telemetry, hyperfold: stats };
}

function renderTelemetry(x: { seeds: string[]; anch: string[]; pressure: CompilePressure; walkers: Walker[]; ret: { path: string[]; steps: number[]; ratio: number }; crystals: { signature: string; pattern: string[]; kind: string }[]; stats: { nodes: number; edges: number }; stretch: number; blend: boolean }): string {
  const lines: string[] = [];
  lines.push(`prog-mo·telemetry   seeds=${x.seeds.length}   anchored=${x.anch.length}   stretch=${x.stretch}x   blend→mo=${x.blend ? "ON" : "off"}`);
  lines.push(`hyperfold(prog):: nodes=${x.stats.nodes} edges=${x.stats.edges}`);
  lines.push("");
  lines.push("── cycle 1 · prog-mo:d (compile-pressure) ──");
  if (x.pressure.length) for (const p of x.pressure.slice(0, 8)) lines.push(`  ${p.sigil} ${p.name.padEnd(12)} ${String(p.score).padStart(3)}%   hits: ${p.hits.join(" · ")}`);
  else lines.push("  (no programming manifolds activated — semantic terrain quiet)");
  lines.push("");
  lines.push("── cycle 2 · competing walkers ──");
  for (const w of x.walkers) {
    const res = w.resonance;
    const wave = res.map((r) => (r > 60 ? "▉" : r > 40 ? "▆" : r > 25 ? "▄" : r > 10 ? "▂" : "·")).join("");
    lines.push(`  ${w.name.padEnd(10)} "${w.question}"`);
    lines.push(`    path (${w.path.length}): ${w.path.slice(0, 12 * x.stretch).join(" → ")}`);
    lines.push(`    resonance:  ${wave}`);
  }
  lines.push("");
  lines.push(`── cycle 3 · return (reversed φ = ${x.ret.ratio.toFixed(4)}) ──`);
  lines.push(`  step sizes:  ${x.ret.steps.join(" ← ")}`);
  lines.push(`  path (${x.ret.path.length}):  ${x.ret.path.slice(0, 20).join(" ← ") || "—"}`);
  lines.push("");
  lines.push("── cycle 4 · crystals (motifs ≥3 walkers) ──");
  if (x.crystals.length) for (const c of x.crystals) lines.push(`  ❄ ${c.pattern.join(" · ")}`);
  else lines.push("  (no recurring motifs — field still exploring)");
  return lines.join("\n");
}
