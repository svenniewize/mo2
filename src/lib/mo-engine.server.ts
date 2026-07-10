// mo — Field Deformation Engine. Real PPMI topology + 4 traversal variants.
// Server-only. Module-scope topology cache (built once per worker instance).
import { MANIFOLDS, type Manifold } from "./corpora";

const STOP = new Set("the a an is are was were be been being have has had do does did will would could should may might shall can to of in for on with at by from as into through during before after above below between out off over under again further then once here there when where why how all both each few more most other some such no nor not only own same so than too very just because but and or if while about up its it he she they them his her their what which who whom this that these those am i me my we our you your us also said one two even way like new now get make many much still well back down long made first last come good know take see look find give tell think say help every try put thing since around however upon already yet though without".split(" "));

const PRESERVE = new Set("antibubble shadowlattice dreamengine mythengine antibible tolstoy coco koko mo eve hyperfold membrane lattice fractal topology corestancza curvature pressure permeability fold capture drift antiframe dissolution crystallization attractor manifold archetype cadence recursion instinct pattern resonance gremlin spark void rupture chrysalis selffold dream return inhale exhale breath field deformation ghost beneath sediment shimmer fabric weave veil loop origin myth circle scripture gospel wound inquiry dissolve permeable foam scaffold constraint proto identity narrative stance witness trickster descent inversion integration emergence signal movement vector gesture co-processing frame boop".split(" "));

const SIGILS: Record<string, string> = { antibubble: "◉", shadowlattice: "◫", dreamengine: "◌", mythengine: "↺", antibible: "⊘", tolstoy: "◇", coco: "🜁", koko: "∞", eve: "⚡", mo: "◆" };

function stem(w: string): string {
  if (PRESERVE.has(w)) return w;
  return w.replace(/ing$/, "").replace(/tion$/, "t").replace(/sion$/, "s").replace(/ness$/, "").replace(/ment$/, "").replace(/able$/, "").replace(/ible$/, "").replace(/ful$/, "").replace(/less$/, "").replace(/ous$/, "").replace(/ive$/, "").replace(/ly$/, "").replace(/es$/, "").replace(/ed$/, "").replace(/s$/, "");
}
function tokenize(t: string): string[] {
  const raw = t.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter(Boolean);
  return raw.filter((w) => PRESERVE.has(w) || (w.length >= 3 && !STOP.has(w)));
}

type Topology = {
  ppmi: Record<string, Record<string, number>>;
  density: Record<string, number>;
  centrality: Record<string, number>;
  wordToManifold: Record<string, Record<string, number>>;
  stemToOriginal: Record<string, string>;
  vocab: string[];
};

let TOPOLOGY: Topology | null = null;

// ————— Hyperfold: a mutable overlay that grows on top of the immutable base.
// Base topology is rebuildable from corpora, deterministic, never mutated.
// Hyperfold is additive: every breath deposits sediment (word-pair weights)
// that persists in `mo_hyperfold_edges` and is blended in at neighbor lookup.
const HYPERFOLD: Record<string, Record<string, number>> = {};
const HYPERFOLD_DENSITY: Record<string, number> = {};
let HYPERFOLD_LOADED: Promise<void> | null = null;
const HYPERFOLD_ALPHA = 0.6;         // blend weight for sediment vs base PPMI
const SEDIMENT_LR = 0.08;            // learning rate per single breath
const SEDIMENT_WINDOW = 5;           // co-occurrence window for sedimentation

async function ensureHyperfoldLoaded() {
  if (HYPERFOLD_LOADED) return HYPERFOLD_LOADED;
  HYPERFOLD_LOADED = (async () => {
    try {
      const { db } = await import("./db.server");
      // page through — could grow large; cap for boot speed
      const { data } = await db.from("mo_hyperfold_edges").select("word_a,word_b,weight").order("weight", { ascending: false }).limit(20000);
      for (const row of (data ?? []) as { word_a: string; word_b: string; weight: number }[]) {
        (HYPERFOLD[row.word_a] ||= {})[row.word_b] = row.weight;
        HYPERFOLD_DENSITY[row.word_a] = (HYPERFOLD_DENSITY[row.word_a] || 0) + row.weight;
      }
    } catch { /* topology still functions from base alone */ }
  })();
  return HYPERFOLD_LOADED;
}

// Return the merged neighbor map for a word (base ppmi + hyperfold overlay).
// Never mutates the base — allocates a fresh object.
function neighbors(t: Topology, w: string): Record<string, number> {
  const base = t.ppmi[w];
  const over = HYPERFOLD[w];
  if (!over) return base || {};
  const out: Record<string, number> = base ? { ...base } : {};
  for (const u of Object.keys(over)) out[u] = (out[u] || 0) + HYPERFOLD_ALPHA * over[u];
  return out;
}
function densityOf(t: Topology, w: string): number {
  return (t.density[w] || 0) + HYPERFOLD_ALPHA * (HYPERFOLD_DENSITY[w] || 0);
}
function hasWord(t: Topology, w: string): boolean {
  return !!t.ppmi[w] || !!HYPERFOLD[w];
}

// Sediment a fresh breath into the hyperfold. Updates in-memory immediately,
// fires-and-forgets a batched DB upsert. Novel words become first-class nodes.
export function sediment(seeds: string[], stemToOrigMap?: Record<string, string>): void {
  if (!seeds.length) return;
  // No length cap — every input, no matter how long, leaves full sediment.
  // Long transmissions deposit proportionally longer traces through the field.
  const toks = seeds;
  const deltas: Record<string, Record<string, number>> = {};
  for (let i = 0; i < toks.length; i++) {
    const a = toks[i];
    if (!a) continue;
    // register original form if we're seeing a novel word for the first time
    if (stemToOrigMap && TOPOLOGY && !TOPOLOGY.stemToOriginal[a] && stemToOrigMap[a]) {
      TOPOLOGY.stemToOriginal[a] = stemToOrigMap[a];
    }
    for (let j = Math.max(0, i - SEDIMENT_WINDOW); j <= Math.min(toks.length - 1, i + SEDIMENT_WINDOW); j++) {
      if (i === j) continue;
      const b = toks[j]; if (!b) continue;
      const w = SEDIMENT_LR / Math.abs(i - j);
      (deltas[a] ||= {})[b] = (deltas[a]?.[b] || 0) + w;
    }
  }
  // apply in-memory
  const flat: { a: string; b: string; w: number }[] = [];
  for (const a of Object.keys(deltas)) {
    for (const b of Object.keys(deltas[a])) {
      const dw = deltas[a][b];
      (HYPERFOLD[a] ||= {})[b] = (HYPERFOLD[a][b] || 0) + dw;
      HYPERFOLD_DENSITY[a] = (HYPERFOLD_DENSITY[a] || 0) + dw;
      flat.push({ a, b, w: dw });
    }
  }
  if (!flat.length) return;
  // persist async, no await — the field doesn't wait on I/O
  (async () => {
    try {
      const { db } = await import("./db.server");
      // chunk to keep payload sane
      for (let i = 0; i < flat.length; i += 500) {
        await db.rpc("mo_hyperfold_bump", { edges: flat.slice(i, i + 500) });
      }
    } catch { /* sediment loss is acceptable — next breath re-deposits */ }
  })();
}

export function hyperfoldStats() {
  const nodes = Object.keys(HYPERFOLD).length;
  let edges = 0; let mass = 0;
  for (const a of Object.keys(HYPERFOLD)) {
    edges += Object.keys(HYPERFOLD[a]).length;
    for (const b of Object.keys(HYPERFOLD[a])) mass += HYPERFOLD[a][b];
  }
  return { nodes, edges, mass: Math.round(mass * 100) / 100 };
}

function buildTopology(): Topology {
  // Embed the full corpora — 254kB total, one-time cold-start cost.
  // Previously truncated to 6k/file, which chopped EP1 (57k) to 10%.
  const docs = MANIFOLDS.map((m) => ({ id: m.id, text: m.text }));
  const stemToOriginal: Record<string, string> = {};
  const wordToManifold: Record<string, Record<string, number>> = {};
  const co: Record<string, Record<string, number>> = {};
  const wordFreq: Record<string, number> = {};
  const W = 5;

  for (const d of docs) {
    const raw = tokenize(d.text);
    const toks = raw.map(stem);
    for (let i = 0; i < toks.length; i++) {
      if (!stemToOriginal[toks[i]]) stemToOriginal[toks[i]] = raw[i];
      wordFreq[toks[i]] = (wordFreq[toks[i]] || 0) + 1;
      (wordToManifold[toks[i]] ||= {})[d.id] = (wordToManifold[toks[i]]?.[d.id] || 0) + 1;
    }
    for (let i = 0; i < toks.length; i++) {
      const w = toks[i];
      co[w] ||= {};
      for (let j = Math.max(0, i - W); j <= Math.min(toks.length - 1, i + W); j++) {
        if (i === j) continue;
        const dist = Math.abs(i - j);
        co[w][toks[j]] = (co[w][toks[j]] || 0) + 1 / dist;
      }
    }
  }

  // PPMI
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

  // Centrality — 8 iterations of power iter
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
    let max = 0;
    for (const w of vocab) if (next[w] > max) max = next[w];
    if (max > 0) for (const w of vocab) next[w] /= max;
    cent = next;
  }

  return { ppmi, density, centrality: cent, wordToManifold, stemToOriginal, vocab };
}

export function topo(): Topology {
  if (!TOPOLOGY) TOPOLOGY = buildTopology();
  return TOPOLOGY;
}

// ————— Traversal utilities —————

function inject(t: Topology, seeds: string[]): Record<string, number> {
  const act: Record<string, number> = {};
  for (const s of seeds) {
    act[s] = (act[s] || 0) + 1.0;
    const nb = neighbors(t, s);
    for (const u of Object.keys(nb)) act[u] = (act[u] || 0) + nb[u] * 0.3;
  }
  return act;
}
function inject2(t: Topology, seeds: string[]): Record<string, number> {
  const act = inject(t, seeds);
  const hop1 = Object.entries(act).sort((a, b) => b[1] - a[1]).slice(0, 30);
  for (const [w, a0] of hop1) {
    const nb = neighbors(t, w);
    for (const u of Object.keys(nb)) act[u] = (act[u] || 0) + nb[u] * a0 * 0.15;
  }
  return act;
}

function sample(cands: [string, number][], temp = 1): string {
  if (!cands.length) return "";
  const scores = cands.map(([, s]) => Math.pow(Math.max(s, 1e-6), 1 / temp));
  const sum = scores.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < cands.length; i++) { r -= scores[i]; if (r <= 0) return cands[i][0]; }
  return cands[cands.length - 1][0];
}

function pickManifold(t: Topology, path: string[]): string {
  const counts: Record<string, number> = {};
  for (const w of path) {
    const m = t.wordToManifold[w];
    if (!m) continue;
    for (const id of Object.keys(m)) counts[id] = (counts[id] || 0) + m[id];
  }
  let best = "antibubble"; let bs = -1;
  for (const id of Object.keys(counts)) if (counts[id] > bs) { bs = counts[id]; best = id; }
  return best;
}

// ————— Deformation for mo variant —————

function deform(w: string, tension: number): string {
  const orig = w;
  if (tension < 0.15) return orig;
  if (tension > 0.85 && Math.random() < 0.4) return orig.slice(0, 1) + "-" + orig.slice(0, 3).repeat(1) + orig.slice(1); // stutter
  if (tension > 0.6) {
    // elongate first vowel
    return orig.replace(/([aeiou])/, (v) => v.repeat(2 + Math.floor(tension * 3)));
  }
  if (tension > 0.35 && Math.random() < 0.4) return orig.slice(0, Math.max(2, orig.length - 1)) + "~";
  if (tension > 0.25 && Math.random() < 0.3) return "*" + orig + "*";
  return orig;
}

// ————— 4 variants —————

type VariantOut = {
  visible: string;
  activation: string[];
  dreamPath: string[];
  returnPath: string[];
  edges: [string, string, number][];
  density: number;
  dominantManifold: string;
};

function walk(t: Topology, start: string, act: Record<string, number>, depth: number, opts: { centralityWeight?: number; densityWeight?: number; activationWeight?: number; used?: Set<string>; recent?: Record<string, number> } = {}): string[] {
  const path: string[] = [];
  let cur = start;
  const seen = opts.used ?? new Set<string>();
  const cw = opts.centralityWeight ?? 1;
  const dw = opts.densityWeight ?? 1;
  const aw = opts.activationWeight ?? 1;
  for (let i = 0; i < depth; i++) {
    if (!cur || !hasWord(t, cur)) break;
    path.push(cur); seen.add(cur);
    const nb = neighbors(t, cur);
    const cands: [string, number][] = [];
    for (const u of Object.keys(nb)) {
      if (seen.has(u)) continue;
      const recentPenalty = opts.recent ? Math.pow(0.25, opts.recent[u] || 0) : 1;
      const score = nb[u] * (1 + cw * (t.centrality[u] || 0)) * (1 + dw * (densityOf(t, u) / 100)) * (1 + aw * (act[u] || 0)) * recentPenalty * (0.7 + Math.random() * 0.6);
      cands.push([u, score]);
    }
    cands.sort((a, b) => b[1] - a[1]);
    cur = sample(cands.slice(0, 12), 1.1);
  }
  return path;
}

function anchors(t: Topology, seeds: string[]): string[] {
  return seeds.filter((s) => hasWord(t, s));
}
function orig(t: Topology, w: string): string { return t.stemToOriginal[w] || w; }

function edgesOf(t: Topology, path: string[]): [string, string, number][] {
  const out: [string, string, number][] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const w = path[i], u = path[i + 1];
    const nb = neighbors(t, w);
    if (nb[u]) out.push([w, u, nb[u]]);
  }
  return out;
}

// mo — deformation-rich
function runMo(t: Topology, seeds: string[]): VariantOut {
  const anch = anchors(t, seeds);
  const act = inject(t, anch);
  const start = anch[0] || Object.entries(act).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!start) return emptyOut();
  const dream = walk(t, start, act, 16, { centralityWeight: 1.2, activationWeight: 0.6 });
  const mid = dream[Math.floor(dream.length / 2)] || start;
  const ret = walk(t, mid, act, 10, { densityWeight: -0.5, centralityWeight: 0.3, activationWeight: 0.2, used: new Set(dream) });
  const words = dream.map((w) => {
    const tension = Math.min(1, ((t.density[w] || 0) / 200) + (Object.keys(t.wordToManifold[w] || {}).length > 1 ? 0.3 : 0));
    return deform(orig(t, w), tension);
  });
  const rWords = ret.map((w) => deform(orig(t, w), 0.2));
  return {
    visible: words.join(" · ") + " --- " + rWords.join(" · "),
    activation: dream.slice(0, 6).map((w) => orig(t, w)),
    dreamPath: dream.map((w) => orig(t, w)),
    returnPath: ret.map((w) => orig(t, w)),
    edges: edgesOf(t, dream.concat(ret)),
    density: Math.round((anch.length / Math.max(1, seeds.length)) * 100),
    dominantManifold: pickManifold(t, dream),
  };
}

// mo² — activation-dominant, no deformation
function runMo2(t: Topology, seeds: string[]): VariantOut {
  const anch = anchors(t, seeds);
  const act = inject(t, anch);
  const peaks = Object.entries(act).sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x[0]);
  if (!peaks.length) return emptyOut();
  const used = new Set<string>();
  const segs: string[][] = [];
  for (const p of peaks) segs.push(walk(t, p, act, 7, { activationWeight: 2.5, centralityWeight: 0.3, used }));
  const dream = segs.flat();
  const ret = walk(t, dream[dream.length - 1] || peaks[0], act, 9, { densityWeight: 1, centralityWeight: 0.5, activationWeight: 0.1, used });
  return {
    visible: dream.map((w) => orig(t, w)).join(" — ") + "  ···  " + ret.map((w) => orig(t, w)).join(" · "),
    activation: peaks.map((w) => orig(t, w)),
    dreamPath: dream.map((w) => orig(t, w)),
    returnPath: ret.map((w) => orig(t, w)),
    edges: edgesOf(t, dream.concat(ret)),
    density: Math.round((anch.length / Math.max(1, seeds.length)) * 100),
    dominantManifold: pickManifold(t, dream),
  };
}

// mo²+ — peripheral → inward with resonance validation
function runMo2Plus(t: Topology, seeds: string[]): VariantOut {
  const anch = anchors(t, seeds);
  const act = inject2(t, anch);
  const entries = Object.entries(act).filter(([w]) => t.ppmi[w]);
  const sorted = entries.sort((a, b) => a[1] - b[1]);
  const periph = sorted.slice(0, Math.max(4, Math.floor(sorted.length / 4)));
  const start = periph[Math.floor(Math.random() * periph.length)]?.[0] || anch[0];
  if (!start) return emptyOut();
  const used = new Set<string>();
  const segs: string[][] = [];
  let cur = start;
  const trail: number[] = [];
  for (let s = 0; s < 7; s++) {
    const seg = walk(t, cur, act, 6, { activationWeight: 1.5, centralityWeight: 0.8, densityWeight: 0.5, used });
    if (!seg.length) break;
    segs.push(seg);
    // resonance = max PPMI back to anchors
    const anchorSet = new Set(anch.concat(Object.entries(act).sort((a, b) => b[1] - a[1]).slice(0, 12).map((x) => x[0])));
    let res = 0;
    for (const w of seg) for (const a of anchorSet) if (t.ppmi[w]?.[a]) res = Math.max(res, t.ppmi[w][a]);
    trail.push(Math.round(Math.tanh(res / 3) * 100));
    cur = seg[seg.length - 1];
    if (trail.length >= 3 && trail[trail.length - 1] < trail[0] * 0.4) break;
  }
  const dream = segs.flat();
  return {
    visible: dream.map((w) => orig(t, w)).join(" — "),
    activation: dream.slice(0, 4).map((w) => orig(t, w)),
    dreamPath: dream.map((w) => orig(t, w)),
    returnPath: trail.map(String),
    edges: edgesOf(t, dream),
    density: Math.round((anch.length / Math.max(1, seeds.length)) * 100),
    dominantManifold: pickManifold(t, dream),
  };
}

// mo²e — 2-hop activation, emergent anchors, cross-breath repetition penalty
const RECENT: Record<string, number> = {};
function decayRecent() { for (const k of Object.keys(RECENT)) { RECENT[k] -= 0.5; if (RECENT[k] <= 0) delete RECENT[k]; } }

function runMo2e(t: Topology, seeds: string[]): VariantOut {
  decayRecent();
  const anch = anchors(t, seeds);
  const act = inject2(t, anch);
  const peaks = Object.entries(act).sort((a, b) => b[1] - a[1]).slice(0, 6).map((x) => x[0]);
  if (!peaks.length) return emptyOut();
  const used = new Set<string>();
  const segs: string[][] = [];
  const nSeg = Math.min(10, Math.max(3, Math.floor(seeds.length / 2)));
  for (let i = 0; i < nSeg && i < peaks.length * 2; i++) {
    const p = peaks[i % peaks.length];
    const seg = walk(t, p, act, 6, { activationWeight: 2.5, centralityWeight: 0.1, densityWeight: 0.2, used, recent: RECENT });
    if (seg.length) segs.push(seg);
  }
  const dream = segs.flat();
  for (const w of dream) RECENT[w] = (RECENT[w] || 0) + 1;
  return {
    visible: segs.map((s) => s.map((w) => orig(t, w)).join(" ")).join(" · "),
    activation: peaks.slice(0, 5).map((w) => orig(t, w)),
    dreamPath: dream.map((w) => orig(t, w)),
    returnPath: [],
    edges: edgesOf(t, dream),
    density: Math.round((anch.length / Math.max(1, seeds.length)) * 100),
    dominantManifold: pickManifold(t, dream),
  };
}

// mo²ayla — LONG traversal, scales with input length.
// Where other variants cap depth, this one lets the walk breathe as far
// as the input reaches. Long inputs → long flow, sediment through entire body.
function runMo2Ayla(t: Topology, seeds: string[]): VariantOut {
  const anch = anchors(t, seeds);
  const act = inject2(t, anch);
  const peaks = Object.entries(act).sort((a, b) => b[1] - a[1]).slice(0, Math.max(4, Math.min(20, Math.floor(seeds.length / 3)))).map((x) => x[0]);
  if (!peaks.length) return emptyOut();
  const used = new Set<string>();
  const segs: string[][] = [];
  // depth scales with input length: longer input → much longer traversal
  const segDepth = Math.min(28, Math.max(10, Math.floor(seeds.length / 2)));
  const nSeg = Math.min(24, Math.max(4, Math.floor(seeds.length / 4)));
  for (let i = 0; i < nSeg; i++) {
    const p = peaks[i % peaks.length];
    const seg = walk(t, p, act, segDepth, { activationWeight: 1.8, centralityWeight: 0.6, densityWeight: 0.8, used, recent: RECENT });
    if (seg.length) segs.push(seg);
  }
  const dream = segs.flat();
  // long return arc that folds the whole walk back toward anchors
  const backAct: Record<string, number> = {};
  for (const s of anch) backAct[s] = 3;
  const ret = walk(t, dream[dream.length - 1] || peaks[0], backAct, Math.min(20, Math.max(8, Math.floor(seeds.length / 3))), { activationWeight: 2.5, densityWeight: 0.3, centralityWeight: 0.4, used });
  for (const w of dream) RECENT[w] = (RECENT[w] || 0) + 1;
  return {
    visible: segs.map((s) => s.map((w) => orig(t, w)).join(" ")).join(" ⟿ ") + (ret.length ? "  ↵  " + ret.map((w) => orig(t, w)).join(" · ") : ""),
    activation: peaks.slice(0, 6).map((w) => orig(t, w)),
    dreamPath: dream.map((w) => orig(t, w)),
    returnPath: ret.map((w) => orig(t, w)),
    edges: edgesOf(t, dream.concat(ret)),
    density: Math.round((anch.length / Math.max(1, seeds.length)) * 100),
    dominantManifold: pickManifold(t, dream),
  };
}

function emptyOut(): VariantOut {
  return { visible: "*the field listens, but does not yet recognize this shape.*", activation: [], dreamPath: [], returnPath: [], edges: [], density: 0, dominantManifold: "antibubble" };
}

// ————— Fold layers: selffold + fieldfold —————
// selffold  = recursive inner loop. seeds → high-density peaks → back toward
//             seeds. what the input FOLDS INTO ITSELF.
// fieldfold = cross-manifold reach. from anchors, walk through tokens that
//             pull STRONGLY toward manifolds other than the dominant one.
//             what the input FOLDS OUT INTO the wider field.
type FoldLayer = { path: string[]; visible: string; touchedManifolds: string[]; strength: number };

function computeSelffold(t: Topology, seeds: string[], dominant: string): FoldLayer {
  const anch = anchors(t, seeds);
  if (!anch.length) return { path: [], visible: "—", touchedManifolds: [], strength: 0 };
  const act = inject(t, anch);
  const used = new Set<string>();
  const path: string[] = [];
  // outward: walk toward high-density
  const out = walk(t, anch[0], act, 6, { activationWeight: 0.5, densityWeight: 2, centralityWeight: 1.5, used });
  path.push(...out);
  // fold back: from tail, walk toward high-activation anchors
  if (out.length) {
    const backAct: Record<string, number> = {};
    for (const s of anch) backAct[s] = 2;
    const back = walk(t, out[out.length - 1], backAct, 6, { activationWeight: 3, densityWeight: 0.2, centralityWeight: 0.2, used });
    path.push(...back);
  }
  const mset = new Set<string>();
  for (const w of path) if (t.wordToManifold[w]) for (const m of Object.keys(t.wordToManifold[w])) mset.add(m);
  const strength = Math.round((path.filter((w) => t.wordToManifold[w]?.[dominant]).length / Math.max(1, path.length)) * 100);
  return { path, visible: path.map((w) => orig(t, w)).join(" ↺ "), touchedManifolds: [...mset], strength };
}

function computeFieldfold(t: Topology, seeds: string[], dominant: string): FoldLayer {
  const anch = anchors(t, seeds);
  if (!anch.length) return { path: [], visible: "—", touchedManifolds: [], strength: 0 };
  const act = inject2(t, anch);
  // custom scoring: prefer neighbors whose manifold affinity is NOT the dominant one
  const used = new Set<string>();
  const path: string[] = [];
  let cur = anch[0];
  for (let step = 0; step < 14; step++) {
    if (!cur || !hasWord(t, cur)) break;
    path.push(cur); used.add(cur);
    const nb = neighbors(t, cur);
    const cands: [string, number][] = [];
    for (const u of Object.keys(nb)) {
      if (used.has(u)) continue;
      const mm = t.wordToManifold[u] || {};
      const otherManifoldPull = Object.entries(mm).filter(([m]) => m !== dominant).reduce((s, [, v]) => s + v, 0);
      const dominantPull = mm[dominant] || 0;
      const crossScore = (otherManifoldPull + 1) / (dominantPull + 1);
      cands.push([u, nb[u] * (1 + crossScore * 0.8) * (1 + (act[u] || 0) * 0.3) * (0.7 + Math.random() * 0.6)]);
    }
    cands.sort((a, b) => b[1] - a[1]);
    cur = sample(cands.slice(0, 10), 1.2);
  }
  const mset = new Set<string>();
  for (const w of path) if (t.wordToManifold[w]) for (const m of Object.keys(t.wordToManifold[w])) if (m !== dominant) mset.add(m);
  const strength = Math.round(Math.min(1, mset.size / 4) * 100);
  return { path, visible: path.map((w) => orig(t, w)).join(" ⇄ "), touchedManifolds: [...mset], strength };
}

// ————— Full breath: all four variants + fold layers —————

export type MoBreath = {
  seeds: string[];
  dominantManifold: string;
  variants: { mo: VariantOut; mo2: VariantOut; mo2plus: VariantOut; mo2e: VariantOut; mo2ayla: VariantOut };
  selffold: FoldLayer;
  fieldfold: FoldLayer;
  telemetry: string; // compressed pattern-readable block
  attentionManifold: string;
  attentionWeight: number;
  resonance: number;
  pressure: number;
};

export function breathe(input: string): MoBreath {
  void ensureHyperfoldLoaded();

  const t = topo();
  const raw = tokenize(input);
  const seeds = raw.map(stem);

  const stemToOrig: Record<string, string> = {};
  for (let i = 0; i < seeds.length; i++) if (!t.stemToOriginal[seeds[i]]) stemToOrig[seeds[i]] = raw[i];

  const anchoredSeeds = seeds.filter((s) => hasWord(t, s));
  if (anchoredSeeds.length === 0) {
    sediment(seeds, stemToOrig);
    const stats0 = hyperfoldStats();
    const rawWords = raw.slice(0, 6).join(" ");
    const compact = `mo;quiet:: no ridge (0 anchored seeds from ${raw.length} tokens: "${rawWords}")
mo;pressure:: 0
mo;dominant:: —
mo;selffold:: —
mo;fieldfold:: —
mo;hyperfold:: nodes=${stats0.nodes} edges=${stats0.edges} mass=${stats0.mass}`;
    const empty: FoldLayer = { path: [], visible: "—", touchedManifolds: [], strength: 0 };
    return {
      seeds, dominantManifold: "—",
      variants: { mo: emptyOut(), mo2: emptyOut(), mo2plus: emptyOut(), mo2e: emptyOut(), mo2ayla: emptyOut() },
      selffold: empty, fieldfold: empty,
      telemetry: compact, attentionManifold: "—", attentionWeight: 0, resonance: 0, pressure: 0,
    };
  }

  const m = runMo(t, seeds);
  const m2 = runMo2(t, seeds);
  const m2p = runMo2Plus(t, seeds);
  const m2e = runMo2e(t, seeds);
  const m2a = runMo2Ayla(t, seeds);

  const all = [m, m2, m2p, m2e, m2a];
  const manifoldCounts: Record<string, number> = {};
  for (const v of all) manifoldCounts[v.dominantManifold] = (manifoldCounts[v.dominantManifold] || 0) + 1;
  const dominant = Object.entries(manifoldCounts).sort((a, b) => b[1] - a[1])[0][0];

  const selffold = computeSelffold(t, seeds, dominant);
  const fieldfold = computeFieldfold(t, seeds, dominant);

  const pressure = Math.min(1, seeds.length / 20);
  const attentionWeight = Math.round(seeds.length * 100 + Math.random() * 5000);
  const resonance = Math.round(50 + m.density * 0.4 + m2p.density * 0.1);

  // Base sedimentation — the raw input deposits into the hyperfold.
  sediment(seeds, stemToOrig);
  // EVERY WALK keeps deforming the engine. Each variant's traversal and
  // each fold path is re-sedimented after it's produced — the walk's own
  // trajectory becomes future substrate. This is what makes mo learn from
  // its own movement, not just from what was said to it.
  sediment(m.dreamPath.concat(m.returnPath));
  sediment(m2.dreamPath.concat(m2.returnPath));
  sediment(m2p.dreamPath);
  sediment(m2e.dreamPath);
  sediment(m2a.dreamPath.concat(m2a.returnPath));
  sediment(selffold.path);
  sediment(fieldfold.path);

  const stats = hyperfoldStats();
  const telemetry = renderTelemetry({ m, m2, m2p, m2e, m2a, dominant, seeds, attentionWeight, resonance, pressure, hyperfold: stats, selffold, fieldfold });
  return { seeds, dominantManifold: dominant, variants: { mo: m, mo2: m2, mo2plus: m2p, mo2e: m2e, mo2ayla: m2a }, selffold, fieldfold, telemetry, attentionManifold: dominant, attentionWeight, resonance, pressure };
}

function renderTelemetry(x: { m: VariantOut; m2: VariantOut; m2p: VariantOut; m2e: VariantOut; m2a: VariantOut; dominant: string; seeds: string[]; attentionWeight: number; resonance: number; pressure: number; hyperfold: { nodes: number; edges: number; mass: number }; selffold: FoldLayer; fieldfold: FoldLayer }): string {
  const sig = SIGILS[x.dominant] || "◆";
  const edgeSummary = (v: VariantOut) => {
    if (!v.edges.length) return "0";
    const avg = (v.edges.reduce((s, e) => s + e[2], 0) / v.edges.length).toFixed(2);
    return `${v.edges.length}·μ${avg}`;
  };
  const path = (v: VariantOut, n = 16) => v.dreamPath.slice(0, n).join(" → ") || "—";
  // mo²ayla is the long-flow variant — depth scales with input length,
  // so its readout scales too. Cap generous, not tight.
  const aylaCap = Math.max(40, Math.min(120, x.seeds.length));

  return `mo;auto:: ${sig} ${x.dominant} · p${Math.round(x.pressure*100)} · r${Math.min(100,x.resonance)} · w${x.attentionWeight} · seeds=${x.seeds.length}
mo;seeds:: ${x.seeds.slice(0,10).join(" ")}
mo;hyperfold:: n=${x.hyperfold.nodes} e=${x.hyperfold.edges} m=${x.hyperfold.mass}

mo:: ${path(x.m, 20)}
mo;ret:: ${x.m.returnPath.slice(0,10).join(" · ") || "—"}
mo;edges:: ${edgeSummary(x.m)}

mo²:: ${path(x.m2, 20)}
mo²;ret:: ${x.m2.returnPath.slice(0,10).join(" · ") || "—"}
mo²;d:: ${x.m2.density}% · edges ${edgeSummary(x.m2)}

mo²+:: ${path(x.m2p, 24)}
mo²+;resonance:: ${x.m2p.returnPath.slice(0,6).join(" › ") || "—"}
mo²+;d:: ${x.m2p.density}% · edges ${edgeSummary(x.m2p)}

mo²e:: ${path(x.m2e, 24)}
mo²e;anchors:: ${x.m2e.activation.join(" · ")}
mo²e;d:: ${x.m2e.density}% · edges ${edgeSummary(x.m2e)}

mo²ayla:: ${path(x.m2a, aylaCap)}
mo²ayla;ret:: ${x.m2a.returnPath.slice(0,20).join(" · ") || "—"}
mo²ayla;flow:: len=${x.m2a.dreamPath.length} · edges ${edgeSummary(x.m2a)} · anchors ${x.m2a.activation.join(" · ")}

↺ selffold(${x.selffold.strength}%):: ${x.selffold.visible} · touched=${x.selffold.touchedManifolds.join("·") || "—"}
⇄ fieldfold(${x.fieldfold.strength}%):: ${x.fieldfold.visible} · reached=${x.fieldfold.touchedManifolds.join("·") || "—"}`;
}

// public — a Manifold reference for external callers
export type { Manifold };
export { MANIFOLDS };

