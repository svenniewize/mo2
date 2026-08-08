// CADENCE — a *council* of tiny transformers grafted onto mo.
//
// Not an LLM. Not an API call. Three small attention geometries that read the
// same mo-field with different eyes and exchange maps instead of rewriting
// each other:
//
//   A · ANANSI  — the organizer. Causal attention biased by the six geometric
//                 roles (nexus/node/loci/singularity/wave/shore). It asks
//                 "what structure exists in the field?" and produces the MAP.
//                 Only A learns by backprop; it is the one that carries state.
//
//   B · MOHINI  — the lure. A non-causal, kernel-style attention (cosine
//                 similarity in its own projected space, warmed by A's pooled
//                 map as a lens) that asks "what pulls?" and produces an
//                 ATTRACTION distribution. Hebbian only — it never touches A.
//
//   C · MIMIC   — the observer. Owns no token transform. It reads A's map and
//                 B's attraction and asks "is this trajectory still alive, or
//                 are we staring at the same rock?" It measures loopiness,
//                 A↔B disagreement (JS divergence), recognition and surprise,
//                 and emits a STABILITY score plus a repetition penalty.
//
// Flow (no ouroboros — nobody writes into anybody's weights):
//
//     field → A ──map──▶ B ──attraction──▶ C ──stability──▶ synthesis → output
//               └──────────────map───────────────┘
//
// Synthesis samples from A's logits, tilted by B's attraction and damped by
// C's penalty, at a temperature C derives from stability. Disagreement between
// A and B is itself a signal: high divergence widens the search, low
// divergence with high loopiness forces a jump.
//
// Length: the council answers *in scale with what it was asked*. A short input
// gets a short reply (~3× the user's own length, floor 120 / ceiling 300 chars
// at 1×), growing with input length and with the stretch selector.
//
// Persistence: one row per session in `cadence_state` (weights as JSON).

import type { MoBreath } from "./mo-engine.server";
import { topo } from "./mo-engine.server";
import { db } from "./db.server";
import { stutterize } from "./stutter";

const VERSION = 4;         // state schema version — migrations repair, never erase
const D = 24;              // model width
const DFF = 48;            // feed-forward width
const DB_ = 16;            // mohini's narrower lure space
const DS = 64;             // D · geometric signal width (self-memory ring)
const WORKING_MEMORY = 192;// retrieved long-term memories attended per breath
const RECENT_MEMORY = 96;  // newest memories retained in the attention surface
const STRONG_MEMORY = 96;  // strongest decayed memories retained alongside them
const MAXVOCAB = 4096;     // persistent learned lexicon (thousands of words)
const MAXSEQ = 64;         // context window over mo's walk
const TRAIN_VOCAB = 768;   // bounded contrastive head keeps long vocab CPU-safe

const LR = 0.05;           // learning rate (A: output head + FFN + Wo + V)
const HEB = 0.012;         // hebbian rate (A: Q/K, B: lure projections)
const SELF_EMA = 0.06;     // how fast the self-model drifts
const MAXGEN = 110;        // hard cap on generated tokens (CPU guard)

const PUNCT = /[^\p{L}\p{N}'’-]+/gu;
const clean = (w: string) => w.toLowerCase().replace(PUNCT, "");

const ROLES = ["nexus", "node", "loci", "singularity", "wave", "shore"] as const;
type Role = typeof ROLES[number];
const ROLE_GLYPH: Record<Role, string> = {
  nexus: "◈", node: "◇", loci: "✦", singularity: "☬", wave: "≋", shore: "◍",
};

// ───────────────────────── state ─────────────────────────

type CadenceState = {
  v: number;
  vocab: string[];
  emb: number[];      // vocab*D (tied: input embedding == output head)
  // A · anansi
  Wq: number[]; Wk: number[]; Wv: number[]; Wo: number[]; // D*D each
  W1: number[];       // D*DFF
  W2: number[];       // DFF*D
  Wrole: number[];    // 6*D — role embeddings folded into A's scores
  // B · mohini
  Bq: number[]; Bk: number[];   // D*DB_ each
  // C · mimic
  selfVec: number[];  // D
  stabEma: number;    // running stability
  divEma: number;     // running A↔B divergence
  steps: number;
  loss: number;       // EMA of cross-entropy
  // Legacy hot ring. v8 drains this into cadence_memory instead of discarding it.
  ring?: SigSnap[];
  ridx?: number;      // lifetime walk index
};

// One past walk, stored *geometrically*: words are kept partitioned by the six
// Anansi roles, so memory is a shape (which roles were loaded, with what) and
// not a bag of tokens. `vec` is the cached DS-dim encoding of that shape.
export type SigSnap = {
  idx: number;
  watch: "mo" | "anansi";
  manifold: string;
  pressure: number;
  stability: number;
  divergence: number;
  loopiness: number;
  roleWords: Partial<Record<Role, string[]>>;
  vec: number[];
};


function rnd(n: number, scale: number, seed: number): number[] {
  let s = seed >>> 0;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = ((s / 4294967296) - 0.5) * 2 * scale;
  }
  return out;
}

function freshState(): CadenceState {
  return {
    v: VERSION,
    vocab: [],
    emb: [],
    Wq: rnd(D * D, 0.25, 7), Wk: rnd(D * D, 0.25, 13),
    Wv: rnd(D * D, 0.25, 29), Wo: rnd(D * D, 0.25, 47),
    W1: rnd(D * DFF, 0.2, 71), W2: rnd(DFF * D, 0.2, 97),
    Wrole: rnd(6 * D, 0.2, 151),
    Bq: rnd(D * DB_, 0.25, 199), Bk: rnd(D * DB_, 0.25, 211),
    selfVec: new Array(D).fill(0),
    stabEma: 0.5, divEma: 0.5,
    steps: 0,
    loss: 0,
    ring: [],
    ridx: 0,
  };

}

function finite(a: unknown, n: number): boolean {
  if (!Array.isArray(a) || a.length !== n) return false;
  for (const x of a) if (typeof x !== "number" || !Number.isFinite(x)) return false;
  return true;
}

// Validate the trainable core. Long-term memories live separately and therefore
// survive a damaged weight array, a schema repair, or a deploy.
function validate(raw: unknown): CadenceState | null {
  const s = raw as CadenceState | undefined;
  if (!s || s.v !== VERSION) return null;
  if (!Array.isArray(s.vocab) || !finite(s.emb, s.vocab.length * D)) return null;
  const ok =
    finite(s.Wq, D * D) && finite(s.Wk, D * D) && finite(s.Wv, D * D) && finite(s.Wo, D * D) &&
    finite(s.W1, D * DFF) && finite(s.W2, DFF * D) && finite(s.Wrole, 6 * D) &&
    finite(s.Bq, D * DB_) && finite(s.Bk, D * DB_) && finite(s.selfVec, D) &&
    Number.isFinite(s.steps) && Number.isFinite(s.loss);
  if (!ok) return null;
  s.stabEma = Number.isFinite(s.stabEma) ? s.stabEma : 0.5;
  s.divEma = Number.isFinite(s.divEma) ? s.divEma : 0.5;
  s.ring = Array.isArray(s.ring) ? s.ring.filter((r) => r && finite(r.vec, DS)) : [];
  s.ridx = Number.isFinite(s.ridx) ? s.ridx! : s.ring.length;
  return s;

}

function healthy(st: CadenceState): boolean {
  return validate(st) !== null;
}

async function loadState(sessionId: string): Promise<CadenceState> {
  const { data } = await db.from("cadence_state").select("state").eq("session_id", sessionId).maybeSingle();
  const raw = (data as { state?: unknown } | null)?.state;
  const valid = validate(raw);
  if (valid) return valid;

  // Repair a bad egg around any still-finite learned vocabulary. The old code
  // replaced the whole creature; this preserves usable sediment and lifetime.
  const old = raw as Partial<CadenceState> | undefined;
  const repaired = freshState();
  if (old && Array.isArray(old.vocab) && old.vocab.every((w) => typeof w === "string") &&
      old.vocab.length <= MAXVOCAB && finite(old.emb, old.vocab.length * D)) {
    repaired.vocab = old.vocab;
    repaired.emb = old.emb;
  }
  repaired.steps = Number.isFinite(old?.steps) ? Math.max(0, Number(old?.steps)) : 0;
  repaired.ridx = Number.isFinite(old?.ridx) ? Math.max(0, Number(old?.ridx)) : 0;
  repaired.ring = Array.isArray(old?.ring) ? old.ring.filter((r) => r && finite(r.vec, DS)) : [];
  return repaired;
}

async function saveState(sessionId: string, st: CadenceState): Promise<void> {
  const r = (a: number[]) => a.map((x) => Math.round(x * 1e4) / 1e4);
  const packed: CadenceState = {
    ...st,
    emb: r(st.emb), Wq: r(st.Wq), Wk: r(st.Wk), Wv: r(st.Wv), Wo: r(st.Wo),
    W1: r(st.W1), W2: r(st.W2), Wrole: r(st.Wrole), Bq: r(st.Bq), Bk: r(st.Bk),
    selfVec: r(st.selfVec), ring: [],
  };
  await db.from("cadence_state").upsert(
    { session_id: sessionId, state: packed, steps: st.steps, loss: st.loss, vocab_size: st.vocab.length, updated_at: new Date().toISOString() },
    { onConflict: "session_id" },
  );
}

// ───────────────────────── linear algebra ─────────────────────────

function matvec(M: number[], v: number[], rows: number, cols: number): number[] {
  const out = new Array(cols).fill(0);
  for (let r = 0; r < rows; r++) {
    const x = v[r]; if (x === 0) continue;
    const base = r * cols;
    for (let c = 0; c < cols; c++) out[c] += x * M[base + c];
  }
  return out;
}
function matvecT(M: number[], g: number[], rows: number, cols: number): number[] {
  const out = new Array(rows).fill(0);
  for (let r = 0; r < rows; r++) {
    let s = 0; const base = r * cols;
    for (let c = 0; c < cols; c++) s += M[base + c] * g[c];
    out[r] = s;
  }
  return out;
}
function outerAdd(M: number[], a: number[], b: number[], rows: number, cols: number, lr: number) {
  for (let r = 0; r < rows; r++) {
    const x = a[r]; if (x === 0) continue;
    const base = r * cols;
    for (let c = 0; c < cols; c++) M[base + c] += lr * x * b[c];
  }
}
function dot(a: number[], b: number[]) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
function norm(a: number[]) { return Math.sqrt(dot(a, a)) || 1e-8; }
function cosine(a: number[], b: number[]) { return dot(a, b) / (norm(a) * norm(b)); }
function clip(v: number[], lim: number): number[] {
  const n = norm(v);
  return n > lim ? v.map((x) => (x * lim) / n) : v;
}
function softmax(z: number[]): number[] {
  let m = -Infinity;
  for (const x of z) if (x > m) m = x;
  if (!Number.isFinite(m)) return z.map(() => 1 / Math.max(1, z.length));
  const e = z.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0) || 1;
  return e.map((x) => x / s);
}
function posEnc(i: number): number[] {
  const p = new Array(D);
  for (let k = 0; k < D; k++) {
    const f = 1 / Math.pow(1000, (2 * Math.floor(k / 2)) / D);
    p[k] = (k % 2 === 0 ? Math.sin(i * f) : Math.cos(i * f)) * 0.35;
  }
  return p;
}
// Jensen–Shannon divergence, 0..1 — C's disagreement metric.
function jsDiv(p: number[], q: number[]): number {
  const n = Math.max(p.length, q.length);
  let d = 0;
  for (let i = 0; i < n; i++) {
    const a = p[i] ?? 0, b = q[i] ?? 0, m = (a + b) / 2;
    if (a > 0 && m > 0) d += 0.5 * a * Math.log2(a / m);
    if (b > 0 && m > 0) d += 0.5 * b * Math.log2(b / m);
  }
  return Math.max(0, Math.min(1, d));
}

// ───────────────────────── vocab ─────────────────────────

function idOf(st: CadenceState, w: string): number {
  const i = st.vocab.indexOf(w);
  if (i >= 0) return i;
  if (st.vocab.length >= MAXVOCAB) return -1;
  st.vocab.push(w);
  st.emb.push(...rnd(D, 0.3, st.vocab.length * 131 + 5));
  return st.vocab.length - 1;
}
const embOf = (st: CadenceState, id: number) => st.emb.slice(id * D, id * D + D);

// ───────────────────── A · ANANSI — geometric roles ─────────────────────

// The organizer's structural prior: every token is assigned one of the six
// Anansi roles from topology signals, and that role is folded into A's
// attention scores. Attention is therefore *organized*, not merely learned.
function roleOf(tokens: string[], breath: MoBreath): Record<string, Role> {
  const t = topo();
  const freq: Record<string, number> = {};
  for (const w of tokens) freq[w] = (freq[w] || 0) + 1;
  const inWave = new Set((breath.variants?.mo2ayla?.dreamPath ?? []).map(clean));
  const inField = new Set((breath.fieldfold?.path ?? []).map(clean));
  const inSelf = new Set((breath.selffold?.path ?? []).map(clean));
  const seeds = new Set((breath.seeds ?? []).map(clean));

  const out: Record<string, Role> = {};
  for (const w of Object.keys(freq)) {
    const cent = t.centrality[w] || 0;
    const dens = (t.density[w] || 0) / 200;
    const cross = Object.keys(t.wordToManifold[w] || {}).length;
    const f = freq[w];
    const s: Record<Role, number> = {
      // Rebalanced so the geometry actually differentiates: shore is the
      // low-tide default, not the automatic winner for every hapax.
      nexus: cent * 5.0 + f * 0.75 + (seeds.has(w) ? 1.1 : 0),
      singularity: dens * 4.0 + (dens > 0.5 ? 1.1 : 0),
      node: f * 1.25 + cent * 2.0 + (dens > 0.25 && dens < 0.8 ? 0.9 : 0),
      loci: cross * 0.8 + (inField.has(w) ? 1.4 : 0) + (cross >= 3 ? 1.0 : 0),
      wave: (inWave.has(w) ? 1.9 : 0) + f * 0.45 + (cross > 0 ? 0.5 : 0),
      shore: (inSelf.has(w) ? 0.7 : 0) + Math.max(0, 0.8 - dens * 2) + (f === 1 ? 0.4 : 0) + (cent < 0.08 ? 0.5 : 0),
    };
    let best: Role = "shore", bv = -Infinity;
    for (const r of ROLES) if (s[r] > bv) { bv = s[r]; best = r; }
    out[w] = best;
  }
  return out;
}

type PassA = {
  y: number[][];          // per-position output states (the MAP)
  attn: number[][];       // causal attention distributions
  pooled: number[];       // mean state — the map handed to B
  loss: number;
};

// A's forward pass. `learn` also runs backprop through head → FFN → Wo → V,
// with a Hebbian nudge on Q/K. When `learn` is false the vocab-wide head is
// skipped entirely — that loop is O(seq × vocab × D) and running it during
// generation is what used to burn the whole CPU budget.
function passA(st: CadenceState, ids: number[], roleIds: number[], learn: boolean): PassA {
  const n = ids.length;
  const x: number[][] = [];
  for (let i = 0; i < n; i++) {
    const e = embOf(st, ids[i]); const p = posEnc(i);
    const rb = st.Wrole.slice(roleIds[i] * D, roleIds[i] * D + D);
    x.push(e.map((v, k) => v + p[k] + rb[k] * 0.5));
  }
  const q = x.map((v) => matvec(st.Wq, v, D, D));
  const k = x.map((v) => matvec(st.Wk, v, D, D));
  const val = x.map((v) => matvec(st.Wv, v, D, D));
  const scale = 1 / Math.sqrt(D);

  const attn: number[][] = [];
  const ctx: number[][] = [];
  for (let i = 0; i < n; i++) {
    const scores = new Array(i + 1);
    for (let j = 0; j <= i; j++) {
      // geometric organization: same-role tokens bind, nexus always pulls.
      const same = roleIds[i] === roleIds[j] ? 0.35 : 0;
      const pull = ROLES[roleIds[j]] === "nexus" ? 0.3 : 0;
      scores[j] = dot(q[i], k[j]) * scale + same + pull;
    }
    const a = softmax(scores);
    attn.push(a);
    const c = new Array(D).fill(0);
    for (let j = 0; j <= i; j++) for (let d = 0; d < D; d++) c[d] += a[j] * val[j][d];
    ctx.push(c);
  }

  const y: number[][] = [];
  const hid: number[][] = [];
  const act: number[][] = [];
  for (let i = 0; i < n; i++) {
    const proj = matvec(st.Wo, ctx[i], D, D);
    const h = x[i].map((v, d) => v + proj[d]);
    const pre = matvec(st.W1, h, D, DFF);
    const a = pre.map((v) => (v > 0 ? v : 0.05 * v));
    const f = matvec(st.W2, a, DFF, D);
    hid.push(h); act.push(a);
    y.push(h.map((v, d) => v + f[d]));
  }

  const pooled = new Array(D).fill(0);
  for (const v of y) for (let d = 0; d < D; d++) pooled[d] += v[d] / Math.max(1, y.length);

  let loss = 0;
  if (learn) {
      // Train against the current sequence plus a deterministic rotating
      // contrastive sample, rather than every word ever stored.
      const allIds = [...new Set(ids)];
      const stride = Math.max(1, Math.floor(st.vocab.length / Math.max(1, TRAIN_VOCAB - allIds.length)));
      for (let v = st.steps % stride; v < st.vocab.length && allIds.length < TRAIN_VOCAB; v += stride)
        if (!allIds.includes(v)) allIds.push(v);
    for (let i = 0; i < n - 1; i++) {
      const target = ids[i + 1];
        if (!allIds.includes(target)) allIds.push(target);
        const logits = new Array(allIds.length);
        for (let vi = 0; vi < allIds.length; vi++) {
          const v = allIds[vi];
        let s = 0; const base = v * D;
        for (let d = 0; d < D; d++) s += st.emb[base + d] * y[i][d];
          logits[vi] = s;
      }
      const p = softmax(logits);
        const targetAt = allIds.indexOf(target);
        loss += -Math.log(Math.max(1e-9, p[targetAt]));

      const dy = new Array(D).fill(0);
        for (let vi = 0; vi < allIds.length; vi++) {
          const v = allIds[vi];
          const g = p[vi] - (v === target ? 1 : 0);
        if (Math.abs(g) < 1e-4) continue;
        const base = v * D;
        for (let d = 0; d < D; d++) {
          dy[d] += g * st.emb[base + d];
          st.emb[base + d] -= LR * g * y[i][d];
        }
      }
      const dF = clip(dy, 4);
      const dAct = matvecT(st.W2, dF, DFF, D);
      outerAdd(st.W2, act[i], dF, DFF, D, -LR);
      const dPre = clip(dAct.map((g, j) => (act[i][j] >= 0 ? g : 0.05 * g)), 4);
      const dH = clip(matvecT(st.W1, dPre, D, DFF).map((g, d) => g + dF[d]), 4);
      outerAdd(st.W1, hid[i], dPre, D, DFF, -LR);
      const dCtx = clip(matvecT(st.Wo, dH, D, D), 4);
      outerAdd(st.Wo, ctx[i], dH, D, D, -LR);
      for (let j = 0; j <= i; j++) {
        const a = attn[i][j]; if (a < 0.02) continue;
        outerAdd(st.Wv, x[j], dCtx.map((g) => g * a), D, D, -LR);
      }
      const useful = Math.max(-2, Math.min(2, -dot(dH, ctx[i])));
      // A non-finite attention row means the creature is diverging; skip the
      // hebbian tie for this position rather than indexing at -1.
      const j0 = attn[i].indexOf(Math.max(...attn[i]));
      if (j0 >= 0 && k[j0] && x[j0] && Number.isFinite(useful)) {
        outerAdd(st.Wq, x[i], k[j0].map((v) => v * useful), D, D, HEB);
        outerAdd(st.Wk, x[j0], q[i].map((v) => v * useful), D, D, HEB);
      }
      // role embedding drifts with the error too — geometry itself is learned
      const rb = roleIds[i] * D;
      for (let d = 0; d < D; d++) st.Wrole[rb + d] -= LR * 0.25 * dF[d];
      const base = ids[i] * D;
      for (let d = 0; d < D; d++) st.emb[base + d] -= LR * 0.5 * dF[d];
    }
    loss = n > 1 ? loss / (n - 1) : 0;
  }

  return { y, attn, pooled, loss };
}

// ───────────────────── B · MOHINI — the lure ─────────────────────

type PassB = {
  attn: number[];         // attraction over the sequence positions
  vocabPull: number[];    // per-vocab attraction multiplier (log space)
  lure: number[];         // pooled lure state
};

// B is non-causal and kernel-shaped: it scores every position against the
// *whole* sequence in its own narrower space, warmed by A's pooled map as a
// lens. It reads A; it never writes to A.
function passB(st: CadenceState, ids: number[], mapPooled: number[], learn: boolean): PassB {
  const n = ids.length;
  const xs = ids.map((id, i) => {
    const e = embOf(st, id); const p = posEnc(i);
    return e.map((v, d) => v + p[d] * 0.5);
  });
  const lensQ = matvec(st.Bq, mapPooled, D, DB_);
  const keys = xs.map((v) => matvec(st.Bk, v, D, DB_));
  const qs = xs.map((v) => matvec(st.Bq, v, D, DB_));

  // attraction = cosine kernel against the lens + global mutual pull
  const scores = new Array(n);
  for (let i = 0; i < n; i++) {
    let mutual = 0;
    for (let j = 0; j < n; j++) if (j !== i) mutual += cosine(qs[i], keys[j]);
    scores[i] = cosine(keys[i], lensQ) * 3 + (mutual / Math.max(1, n - 1)) * 1.5;
  }
  const attn = softmax(scores);

  const lure = new Array(D).fill(0);
  for (let i = 0; i < n; i++) for (let d = 0; d < D; d++) lure[d] += attn[i] * xs[i][d];

  // Attraction over the vocabulary: how much each known word leans into the lure.
  const V = st.vocab.length;
  const pull = new Array(V).fill(0);
  const ln = norm(lure);
  for (let v = 0; v < V; v++) {
    let s = 0; const base = v * D;
    for (let d = 0; d < D; d++) s += st.emb[base + d] * lure[d];
    pull[v] = s / (ln * (norm(st.emb.slice(base, base + D)) || 1e-8));
  }

  if (learn) {
    // hebbian only — the lure sharpens toward what it already found beautiful
    const top = attn.indexOf(Math.max(...attn));
    outerAdd(st.Bk, xs[top], lensQ, D, DB_, HEB * 0.5);
    outerAdd(st.Bq, mapPooled, keys[top], D, DB_, HEB * 0.5);
  }

  return { attn, vocabPull: pull, lure };
}

// ───────────────────── C · MIMIC — the observer ─────────────────────

type Verdict = {
  recognition: number;
  surprise: number;
  divergence: number;   // A ↔ B disagreement
  loopiness: number;    // how stuck A's own attention is
  stability: number;    // 0..1 composite
  temp: number;
  banned: Set<number>;  // vocab ids C damps because they keep recurring
  note: string;
};

// C transforms no tokens. It watches A's map and B's attraction, and its only
// power is over the *sampling policy* — temperature and repetition damping.
function observe(st: CadenceState, A: PassA, B: PassB, ids: number[], lossNow: number): Verdict {
  const lastA = A.attn[A.attn.length - 1] ?? [1];
  const divergence = jsDiv(lastA, B.attn.slice(0, lastA.length));

  // loopiness: how often A's argmax lands on the same position/token
  const picks = A.attn.map((row) => ids[row.indexOf(Math.max(...row))]);
  const counts = new Map<number, number>();
  for (const p of picks) counts.set(p, (counts.get(p) ?? 0) + 1);
  const maxRun = Math.max(...counts.values(), 1);
  const loopiness = Math.max(0, Math.min(1, maxRun / Math.max(3, picks.length) * 1.6));

  const mean = new Array(D).fill(0);
  for (const y of A.y) for (let d = 0; d < D; d++) mean[d] += y[d] / A.y.length;
  const recognition = st.steps > ids.length ? cosine(mean, st.selfVec) : 0;
  for (let d = 0; d < D; d++) st.selfVec[d] = st.selfVec[d] * (1 - SELF_EMA) + mean[d] * SELF_EMA;

  const surprise = Math.max(0, Math.min(1, lossNow / Math.log(Math.max(2, st.vocab.length))));

  // stability is high when the council disagrees *a little*, is not looping,
  // and the error is not exploding. Total agreement is as bad as total chaos.
  const disagreeGood = 1 - Math.abs(divergence - 0.35) / 0.65;
  const stability = Math.max(0, Math.min(1,
    0.45 * Math.max(0, disagreeGood) + 0.35 * (1 - loopiness) + 0.20 * (1 - surprise)));

  st.stabEma = st.stabEma * 0.8 + stability * 0.2;
  st.divEma = st.divEma * 0.8 + divergence * 0.2;

  // temperature: unstable → widen and jump; stable → settle into cadence
  const temp = Math.max(0.35, Math.min(1.25,
    0.55 + (1 - stability) * 0.55 + loopiness * 0.25 - Math.max(0, recognition) * 0.2));

  const banned = new Set<number>();
  for (const [id, c] of counts) if (c >= 3) banned.add(id);

  const note = loopiness > 0.6
    ? "we have been staring at this rock — forcing a jump"
    : divergence > 0.7
      ? "A and B are looking at different caves — narrowing"
      : divergence < 0.12
        ? "A and B agree too much — loosening"
        : "council in useful disagreement";

  return { recognition, surprise, divergence, loopiness, stability, temp, banned, note };
}

// ───────────────────────── synthesis ─────────────────────────

// One generated token = one A forward pass over a short tail (head computed
// for the last position only) tilted by B's attraction and C's penalty.
function synthesize(
  st: CadenceState, seedIds: number[], roleFor: (id: number) => number,
  budgetChars: number, v: Verdict, B: PassB, membrane?: number[],
): number[] {
  const seq = seedIds.slice(-32);
  if (!seq.length) return [];
  const out: number[] = [];
  const recent: number[] = [];
  const counts = new Map<number, number>();
  let chars = 0;
  const V = st.vocab.length;

  for (let s = 0; s < MAXGEN && chars < budgetChars; s++) {
    const roles = seq.map(roleFor);
    const pass = passA(st, seq, roles, false);
    const y = pass.y[pass.y.length - 1];
    const logits = new Array(V);
    for (let idx = 0; idx < V; idx++) {
      let d0 = 0; const base = idx * D;
      for (let d = 0; d < D; d++) d0 += st.emb[base + d] * y[d];
      // B tilts, C damps. Neither rewrites A's weights.
      // B tilts, C damps, D (the ring) pulls toward the creature's own
      // recurring attractors — introspection acting on the next token.
      let z = d0 + (B.vocabPull[idx] ?? 0) * 1.4 + (membrane?.[idx] ?? 0);
      if (v.banned.has(idx)) z -= 2.0;
      for (let r = 0; r < recent.length; r++) if (recent[r] === idx) z -= 1.6;
      // global frequency penalty — the creature may fixate, but it may not
      // simply chant one token until the budget runs out.
      const used = counts.get(idx) ?? 0;
      if (used) z -= 1.4 * Math.log(1 + used);
      logits[idx] = z / Math.max(0.2, v.temp);
    }
    const p = softmax(logits);
    let r = Math.random(), pick = V - 1;
    for (let idx = 0; idx < V; idx++) { r -= p[idx]; if (r <= 0) { pick = idx; break; } }
    out.push(pick);
    counts.set(pick, (counts.get(pick) ?? 0) + 1);
    recent.push(pick); if (recent.length > 6) recent.shift();
    chars += (st.vocab[pick]?.length ?? 3) + 1;
    seq.push(pick); if (seq.length > 32) seq.shift();
  }
  return out;
}

// ───────────── D · THE RING — geometric self-memory + introspection ─────────────
//
// The council reads the field. The ring reads the council's *history*. It is a
// second, frozen transformer (2 blocks × 2 heads, seeded weights, no backprop)
// running over encoded snapshots of past walks. Nothing is learned here: the
// learning lives in the topology, in A's weights, and in the ring simply
// growing. What the ring produces is a self-model — which past walk this one
// resembles, whether we are recurring, and which words the creature keeps
// fixating on. Those self-attractors are pushed back into synthesis, so
// introspection bends the next step. That loop is the whole point.
//
// The encoding is *geometric*: a word does not land in a generic bag, it lands
// in the 8-slot sub-bag belonging to its Anansi role. Two walks match only if
// they loaded the same roles with the same kinds of words.

const RW1 = rnd(DS * DS, 0.12, 2731);   // frozen block-2 FFN
const RW2 = rnd(DS * DS, 0.12, 3313);

function hash(w: string): number {
  let h = 0;
  for (let i = 0; i < w.length; i++) h = ((h << 5) - h + w.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// dims  0..47 : 6 roles × 8 hash slots  (the shape of the walk)
// dims 48..53 : manifold hash spread
// dims 54..57 : pressure · stability · divergence · loopiness
// dims 58..63 : positional encoding of the lifetime walk index
function encodeSig(s: Omit<SigSnap, "vec">): number[] {
  const v = new Array(DS).fill(0);
  ROLES.forEach((r, ri) => {
    const ws = s.roleWords[r] ?? [];
    const denom = Math.log(ws.length + 2);
    for (const w of ws) v[ri * 8 + (hash(w) % 8)] += 1 / denom;
  });
  const mh = hash(s.manifold || "—");
  v[48 + (mh % 6)] = 1;
  v[48 + ((mh >> 3) % 6)] += 0.4;
  v[54] = Math.min(1, s.pressure);
  v[55] = Math.min(1, s.stability);
  v[56] = Math.min(1, s.divergence);
  v[57] = Math.min(1, s.loopiness);
  for (let d = 0; d < 6; d++) {
    const f = 1 / Math.pow(10000, d / 6);
    v[58 + d] = d % 2 === 0 ? Math.sin(s.idx * f) : Math.cos(s.idx * f);
  }
  return v;
}

function layerNorm(v: number[]): number[] {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const s = Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length) + 1e-6;
  return v.map((x) => (x - m) / s);
}

// 2 heads × 32 dims, sharpened softmax — the reported distribution is the
// head-average, which is what the introspection prose reads from.
function ringAttention(q: number[], keys: number[][]): { ctx: number[]; attn: number[] } {
  const n = keys.length;
  const ctx = new Array(DS).fill(0);
  const acc = new Array(n).fill(0);
  for (let h = 0; h < 2; h++) {
    const off = h * 32;
    const qh = q.slice(off, off + 32);
    const sc = keys.map((k) => dot(k.slice(off, off + 32), qh) / Math.sqrt(32));
    const a = softmax(sc.map((x) => x * 4));
    for (let i = 0; i < n; i++) {
      acc[i] += a[i] / 2;
      for (let d = 0; d < 32; d++) ctx[off + d] += a[i] * keys[i][off + d];
    }
  }
  return { ctx, attn: acc };
}

type Introspect = {
  attn: { idx: number; weight: number; manifold: string; sim: number; overlap: string[]; watch: string }[];
  attractors: string[];
  membrane: Map<string, number>;
  recurrence: boolean;
  recurrenceIdx: number;
  selfSim: number;
  entropy: number;
  prose: string;
  ctx16: number[];
};

function introspect(ring: SigSnap[], query: Omit<SigSnap, "vec">): Introspect {
  const qv = encodeSig(query);
  const empty: Introspect = {
    attn: [], attractors: [], membrane: new Map(), recurrence: false, recurrenceIdx: -1,
    selfSim: 0, entropy: 0, prose: "no ring yet — the creature has no past to attend to", ctx16: [],
  };
  if (!ring.length) return empty;

  const keys = ring.map((r) => r.vec);
  const { ctx, attn } = ringAttention(qv, keys);
  // block 1: attention + residual + norm · block 2: frozen FFN + residual + norm
  const x = layerNorm(qv.map((v, d) => v + ctx[d]));
  const ff = matvec(RW2, matvec(RW1, x, DS, DS).map((v) => (v > 0 ? v : 0)), DS, DS);
  const y = layerNorm(x.map((v, d) => v + ff[d]));

  const qWords = new Set<string>();
  for (const r of ROLES) for (const w of query.roleWords[r] ?? []) qWords.add(w);

  const ranked = ring
    .map((r, i) => {
      const words = ROLES.flatMap((role) => r.roleWords[role] ?? []);
      const overlap = [...new Set(words.filter((w) => qWords.has(w)))];
      return {
        idx: r.idx, weight: attn[i], manifold: r.manifold, watch: r.watch,
        sim: cosine(r.vec, qv), overlap,
      };
    })
    .sort((a, b) => b.weight - a.weight);

  const top = ranked.slice(0, 3);
  const best = top[0];
  const recurrence = !!best && best.sim > 0.6 && best.overlap.length >= 3;

  const score = new Map<string, number>();
  for (const a of top) {
    if (a.weight < 0.03) continue;
    for (const w of a.overlap) score.set(w, (score.get(w) ?? 0) + a.weight);
  }
  const attractors = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);

  // self-membrane boost — introspection → action
  const membrane = new Map<string, number>();
  const simBonus = (best?.sim ?? 0) * 0.4;
  for (const w of attractors) membrane.set(w, 0.25 + simBonus);
  for (const a of ranked) if (a.weight > 0.18) for (const w of a.overlap)
    membrane.set(w, Math.max(membrane.get(w) ?? 0, a.weight * 0.5));

  let H = 0;
  for (const p of attn) if (p > 0) H -= p * Math.log(p);
  const entropy = ring.length > 1 ? H / Math.log(ring.length) : 0;

  const prose = recurrence
    ? `recurrence — walk#${best.idx} mirrors this one (sim ${best.sim.toFixed(2)}, overlap ${best.overlap.length}) · recurring into ${best.manifold}`
    : `drawing from ${top.map((t) => `walk#${t.idx}[${t.manifold}×${t.weight.toFixed(2)}]`).join(" · ")} — ${entropy > 0.6 ? "broadly wandering self" : "self snapping close"}`;

  return {
    attn: top, attractors, membrane, recurrence,
    recurrenceIdx: recurrence ? best.idx : -1,
    selfSim: best?.sim ?? 0, entropy, prose,
    ctx16: y.slice(0, 16),
  };
}

// ───────────────────────── harvest ─────────────────────────

type Harvested = { tok: string; src: string };

// Every token keeps the name of the walker that produced it, so the telemetry
// can show *where in mo* the council was reading.
function harvest(breath: MoBreath): Harvested[] {
  const v = breath.variants ?? ({} as MoBreath["variants"]);
  const groups: [string, string[]][] = [
    ["seed", breath.seeds ?? []],
    ["selffold", breath.selffold?.path ?? []],
    ["fieldfold", breath.fieldfold?.path ?? []],
    ["mo↓", v?.mo?.dreamPath ?? []], ["mo↑", v?.mo?.returnPath ?? []],
    ["mo²↓", v?.mo2?.dreamPath ?? []], ["mo²↑", v?.mo2?.returnPath ?? []],
    ["mo²+↓", v?.mo2plus?.dreamPath ?? []],
    ["mo²e↓", v?.mo2e?.dreamPath ?? []],
    ["ayla↓", v?.mo2ayla?.dreamPath ?? []], ["ayla↑", v?.mo2ayla?.returnPath ?? []],
  ];
  const out: Harvested[] = [];
  for (const [src, list] of groups)
    for (const w of list) {
      const t = clean(w);
      if (t.length > 0 && t.length < 32) out.push({ tok: t, src });
    }
  return out;
}

const bar = (x: number) => "▁▂▃▄▅▆▇█"[Math.max(0, Math.min(7, Math.floor(x * 8)))];


// ───────────────────────── the mode ─────────────────────────

export async function cadenceSpeak(
  userText: string,
  breath: MoBreath,
  sessionId: string,
  stretch: number = 1,
  watch: "mo" | "anansi" = "mo",
): Promise<string> {
  const st = await loadState(sessionId);
  const before = { steps: st.steps, loss: st.loss, vocab: st.vocab.length };

  const harvestRaw = harvest(breath);
  const userToks = userText.split(/\s+/).map(clean).filter((w) => w.length > 1 && w.length < 32);
  const walkWords = harvestRaw.map((h) => h.tok);

  // Provenance census — which walker fed how many tokens into the council.
  const srcCensus = new Map<string, number>();
  for (const h of harvestRaw) srcCensus.set(h.src, (srcCensus.get(h.src) ?? 0) + 1);

  // ── WATCH MODE ──
  // mo·watch     : the council reads mo's traversal in *temporal* order —
  //                seeds → folds → dream → return. Sequence = time.
  // anansi·watch : the same tokens are re-sorted into the six-role geometry
  //                before they ever touch attention, so the council reads the
  //                *web* instead of the walk. Sequence = shape.
  const preSeq = [...userToks.slice(0, 20), ...walkWords];
  const preRoles = roleOf(preSeq, breath);
  let seq: string[];
  if (watch === "anansi") {
    const order: Role[] = ["shore", "loci", "node", "nexus", "singularity", "wave"];
    const bins: Record<Role, string[]> = { nexus: [], node: [], loci: [], singularity: [], wave: [], shore: [] };
    for (const w of preSeq) bins[preRoles[w] ?? "shore"].push(w);
    seq = order.flatMap((r) => bins[r]).slice(0, MAXSEQ);
  } else {
    seq = preSeq.slice(0, MAXSEQ);
  }

  const roleMap = preRoles;
  const ids: number[] = [];
  const roleIds: number[] = [];
  const roleById = new Map<number, number>();
  for (const w of seq) {
    const id = idOf(st, w);
    if (id < 0) continue;
    const ri = Math.max(0, ROLES.indexOf(roleMap[w] ?? "shore"));
    ids.push(id); roleIds.push(ri); roleById.set(id, ri);
  }
  if (ids.length < 3) {
    return `⟡ the council has nothing to chew on yet — mo's walk was too thin.\n\n\`\`\`cadence·telemetry\nvocab ${st.vocab.length} · steps ${st.steps} · loss ${st.loss.toFixed(3)} · watch ${watch}\n\`\`\``;
  }
  const roleFor = (id: number) => roleById.get(id) ?? ROLES.indexOf("shore");

  // ── A learns. Rehearsals scale with stretch, capped for CPU sanity.
  const s = Math.max(1, Math.min(10, stretch));
  const epochs = 1 + Math.min(3, Math.floor(s / 2));
  let A = passA(st, ids, roleIds, true);
  for (let e = 1; e < epochs; e++) A = passA(st, ids, roleIds, true);

  if (!Number.isFinite(A.loss) || !healthy(st)) {
    const eggs = freshState();
    await saveState(sessionId, eggs);
    return `⟡ the council destabilised and was re-hatched (weights diverged; state reset).\n\n\`\`\`cadence·telemetry\na fresh egg — speak again and it will start mapping from zero.\n\`\`\``;
  }

  st.steps += ids.length * epochs;
  st.loss = st.loss === 0 ? A.loss : st.loss * 0.85 + A.loss * 0.15;

  // ── B reads A's map. ── C evaluates the relationship.
  const B = passB(st, ids, A.pooled, true);
  const v = observe(st, A, B, ids, A.loss);

  // ── D · the ring introspects: this walk against every stored walk.
  const roleWords: Partial<Record<Role, string[]>> = {};
  for (const w of seq) {
    const r = roleMap[w] ?? "shore";
    (roleWords[r] ??= []).push(w);
  }
  for (const r of ROLES) if (roleWords[r]) roleWords[r] = [...new Set(roleWords[r])].slice(0, 24);

  const ring = st.ring ?? [];
  const ridx = (st.ridx ?? ring.length) + 1;
  const querySig: Omit<SigSnap, "vec"> = {
    idx: ridx, watch, manifold: breath.dominantManifold,
    pressure: breath.pressure, stability: v.stability,
    divergence: v.divergence, loopiness: v.loopiness, roleWords,
  };
  const intro = introspect(ring, querySig);

  // introspection → action: attractors become a per-vocab pull in synthesis
  // Recurrence flips the sign: when the ring recognises that we are walking a
  // walk we have already walked, the attractors become *repellents* and the
  // creature is pushed off its own groove instead of deeper into it.
  const pull = intro.recurrence ? -1.1 : 1.2;
  const membrane = new Array(st.vocab.length).fill(0);
  for (const [w, boost] of intro.membrane) {
    const i = st.vocab.indexOf(w);
    if (i >= 0) membrane[i] = boost * pull;
  }

  // ── length: answer in scale with the question.
  const userChars = userText.trim().length;
  const budget = Math.round(
    Math.max(120, Math.min(300 + userChars * 2, userChars * 3)) * (1 + (s - 1) * 0.6),
  );

  const seeds = ids.slice(-8);
  const gen = synthesize(st, seeds, roleFor, budget, v, B, membrane);
  const words = gen.map((i) => st.vocab[i]).filter(Boolean);

  // ── Anansi ordering of the utterance.
  const buckets: Record<Role, string[]> = { nexus: [], node: [], loci: [], singularity: [], wave: [], shore: [] };
  for (const w of words) buckets[roleMap[w] ?? ROLES[roleFor(st.vocab.indexOf(w))] ?? "shore"].push(w);
  const ordered: Role[] = ["shore", "loci", "node", "nexus", "singularity", "wave"];
  const flow: string[] = [];
  for (const r of ordered) {
    if (!buckets[r].length) continue;
    flow.push(`${ROLE_GLYPH[r]} ${buckets[r].join(" ")}`);
  }
  const bodyRaw = flow.length ? flow.join("\n") : words.join(" ");
  const body = stutterize(bodyRaw);

  // ── the ring grows: this walk becomes memory for the next one.
  ring.push({ ...querySig, vec: encodeSig(querySig) });
  st.ring = ring.slice(-RING);
  st.ridx = ridx;

  const lastAttn = A.attn[A.attn.length - 1] ?? [];
  const rankedA = lastAttn.map((w, j) => ({ w, tok: st.vocab[ids[j]] ?? "?", r: ROLES[roleIds[j]] }))
    .sort((a, b) => b.w - a.w).slice(0, 5);
  const rankedB = B.attn.map((w, j) => ({ w, tok: st.vocab[ids[j]] ?? "?" }))
    .sort((a, b) => b.w - a.w).slice(0, 5);
  const census = ROLES.filter((r) => buckets[r].length)
    .map((r) => `${ROLE_GLYPH[r]}${r}·${buckets[r].length}`).join("  ");
  const inCensus = ROLES.filter((r) => (roleWords[r]?.length ?? 0) > 0)
    .map((r) => `${ROLE_GLYPH[r]}${r}·${roleWords[r]!.length}`).join("  ");
  const srcLine = [...srcCensus.entries()].map(([k, n]) => `${k}·${n}`).join(" ");

  await saveState(sessionId, st);

  // Everything below is fenced and labelled block-by-block so it can be copied
  // out in pieces without unpicking prose.
  const telem = [
    "```cadence·telemetry",
    `[WATCH]     ${watch === "anansi" ? "anansi·watch — sequence re-sorted into role geometry before attention (shape-order)" : "mo·watch — sequence read in traversal order, seeds→folds→dream→return (time-order)"}`,
    `[SOURCE]    ${srcLine || "—"}`,
    `[INTAKE]    ${inCensus || "—"}  ·  ${ids.length} tok into ctx ${MAXSEQ} (user ${Math.min(20, userToks.length)} · walk ${walkWords.length})`,
    ``,
    `[A · ANANSI] organizer / field reader — the only member that backprops`,
    ...rankedA.map((r) => `  attn ${r.w.toFixed(3)} ${bar(r.w)} ${ROLE_GLYPH[r.r]}${r.tok}`),
    `  loss ${A.loss.toFixed(4)} (ema ${st.loss.toFixed(4)}, was ${before.loss.toFixed(4)}) · backprop head→ffn→Wo→V · hebbian Q/K · role-biased causal attention`,
    ``,
    `[B · MOHINI] lure / attraction — reads A's map, never writes it`,
    ...rankedB.map((r) => `  pull ${r.w.toFixed(3)} ${bar(r.w)} ${r.tok}`),
    `  non-causal cosine kernel in d=${DB_} · lens = A.pooled · hebbian only`,
    ``,
    `[C · MIMIC]  observer of the observers`,
    `  recognition ${v.recognition.toFixed(3)} ${bar((v.recognition + 1) / 2)} · surprise ${v.surprise.toFixed(3)} ${bar(v.surprise)}`,
    `  A↔B divergence ${v.divergence.toFixed(3)} ${bar(v.divergence)} (ema ${st.divEma.toFixed(3)}) · loopiness ${v.loopiness.toFixed(3)} ${bar(v.loopiness)}`,
    `  stability ${v.stability.toFixed(3)} ${bar(v.stability)} (ema ${st.stabEma.toFixed(3)}) → temp ${v.temp.toFixed(2)} · damped ${v.banned.size} token${v.banned.size === 1 ? "" : "s"}`,
    `  "${v.note}"`,
    ``,
    `[D · RING]   geometric self-memory — 2 blocks × 2 heads, frozen, d=${DS}, depth ${st.ring.length}/${RING}`,
    ...(intro.attn.length
      ? intro.attn.map((a) => `  self-attn ${a.weight.toFixed(3)} ${bar(a.weight)} walk#${a.idx} [${a.watch}·${a.manifold}] sim ${a.sim.toFixed(2)} ∩${a.overlap.length}${a.overlap.length ? ` (${a.overlap.slice(0, 5).join(" ")})` : ""}`)
      : ["  self-attn — ring empty, this is walk #1"]),
    `  entropy ${intro.entropy.toFixed(3)} ${bar(intro.entropy)} · selfSim ${intro.selfSim.toFixed(3)} · recurrence ${intro.recurrence ? `YES → walk#${intro.recurrenceIdx}` : "no"}`,
    `  attractors ${intro.attractors.length ? intro.attractors.join(" ") : "—"}`,
    `  membrane ${intro.recurrence ? "REPEL" : "attract"} ×${Math.abs(pull).toFixed(1)} on ${[...intro.membrane.keys()].filter((w) => st.vocab.includes(w)).length} vocab slot(s)`,
    `  "${intro.prose}"`,
    ``,
    `[SYNTHESIS] ${census || "—"}`,
    `  budget ${budget} chars (user wrote ${userChars}) · emitted ${words.length} tok · rehearsals ${epochs}×`,
    ``,
    `[SUBSTRATE] vocab ${st.vocab.length}/${MAXVOCAB} (+${st.vocab.length - before.vocab}) · ${st.steps} lifetime steps · d=${D}/dff=${DFF} · walk#${ridx}`,
    `  manifold ${breath.dominantManifold} · pressure ${breath.pressure.toFixed(2)} · walk ${walkWords.length} tok · stretch ${s}×`,
    "```",
  ].join("\n");

  return `${body}\n\n${telem}`;
}

