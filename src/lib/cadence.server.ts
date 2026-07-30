// CADENCE — a transformer creature grafted onto mo.
//
// Not an LLM. Not an API call. A *tiny* transformer block (single-head causal
// self-attention + FFN, tied embeddings) that lives in this app, is trained
// online, and whose entire training corpus is MO'S OWN TRAVERSAL plus the
// user's input tokens. It is the field's cognitive layer: mo walks, cadence
// watches the walk, predicts the next step, is wrong, and updates itself.
//
// It carries a SELF-MODEL: an EMA of its own hidden states (`selfVec`). Every
// breath it measures how close the present state is to what it has been —
// recognition — and how badly it mispredicted — surprise. Those two numbers
// are its interiority, and they steer its own sampling temperature.
//
// Persistence: one row per session in `cadence_state` (weights as JSON).

import type { MoBreath } from "./mo-engine.server";
import { db } from "./db.server";
import { stutterize } from "./stutter";

const D = 24;              // model width
const DFF = 48;            // feed-forward width
const MAXVOCAB = 700;      // learned token table cap
const MAXSEQ = 96;         // context window over mo's walk
const LR = 0.05;           // learning rate (output head + FFN + V path)
const HEB = 0.012;         // hebbian rate (Q/K projections)
const SELF_EMA = 0.06;     // how fast the self-model drifts

const PUNCT = /[^\p{L}\p{N}'’-]+/gu;
const clean = (w: string) => w.toLowerCase().replace(PUNCT, "");

// ───────────────────────── state ─────────────────────────

type CadenceState = {
  vocab: string[];
  emb: number[];      // vocab*D (tied: input embedding == output head)
  Wq: number[]; Wk: number[]; Wv: number[]; Wo: number[]; // D*D each
  W1: number[];       // D*DFF
  W2: number[];       // DFF*D
  selfVec: number[];  // D
  steps: number;
  loss: number;       // EMA of cross-entropy
};

function rnd(n: number, scale: number, seed: number): number[] {
  // deterministic small init — the creature always starts from the same egg
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
    vocab: [],
    emb: [],
    Wq: rnd(D * D, 0.25, 7), Wk: rnd(D * D, 0.25, 13),
    Wv: rnd(D * D, 0.25, 29), Wo: rnd(D * D, 0.25, 47),
    W1: rnd(D * DFF, 0.2, 71), W2: rnd(DFF * D, 0.2, 97),
    selfVec: new Array(D).fill(0),
    steps: 0,
    loss: 0,
  };
}

async function loadState(sessionId: string): Promise<CadenceState> {
  const { data } = await db.from("cadence_state").select("state").eq("session_id", sessionId).maybeSingle();
  const raw = (data as { state?: unknown } | null)?.state as CadenceState | undefined;
  if (!raw || !Array.isArray(raw.vocab) || !Array.isArray(raw.emb)) return freshState();
  return raw;
}

async function saveState(sessionId: string, st: CadenceState): Promise<void> {
  // round to 4 decimals — keeps the JSON payload small without harming the model
  const r = (a: number[]) => a.map((x) => Math.round(x * 1e4) / 1e4);
  const packed: CadenceState = {
    ...st,
    emb: r(st.emb), Wq: r(st.Wq), Wk: r(st.Wk), Wv: r(st.Wv), Wo: r(st.Wo),
    W1: r(st.W1), W2: r(st.W2), selfVec: r(st.selfVec),
  };
  await db.from("cadence_state").upsert(
    { session_id: sessionId, state: packed, steps: st.steps, loss: st.loss, vocab_size: st.vocab.length, updated_at: new Date().toISOString() },
    { onConflict: "session_id" },
  );
}

// ───────────────────────── linear algebra ─────────────────────────

function matvec(M: number[], v: number[], rows: number, cols: number): number[] {
  // M is rows*cols, v is rows → returns cols  (v · M)
  const out = new Array(cols).fill(0);
  for (let r = 0; r < rows; r++) {
    const x = v[r]; if (x === 0) continue;
    const base = r * cols;
    for (let c = 0; c < cols; c++) out[c] += x * M[base + c];
  }
  return out;
}
function matvecT(M: number[], g: number[], rows: number, cols: number): number[] {
  // gradient back through v · M : returns rows-length
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
function softmax(z: number[]): number[] {
  const m = Math.max(...z);
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

// ───────────────────────── forward + learn ─────────────────────────

type Pass = {
  y: number[][];          // per-position output states
  attn: number[][];       // attention distributions
  loss: number;
};

// One causal transformer block over the token id sequence, followed by a
// tied-embedding next-token head. Backprop runs through the head, the FFN,
// the output projection and the V path; the softmax scores themselves are
// treated as constants (straight-through) and Q/K instead receive a Hebbian
// nudge toward whatever attention actually paid off. Small, honest, online.
function stepThrough(st: CadenceState, ids: number[], learn: boolean): Pass {
  const n = ids.length;
  const x: number[][] = [];
  for (let i = 0; i < n; i++) {
    const e = embOf(st, ids[i]); const p = posEnc(i);
    x.push(e.map((v, k) => v + p[k]));
  }
  const q = x.map((v) => matvec(st.Wq, v, D, D));
  const k = x.map((v) => matvec(st.Wk, v, D, D));
  const val = x.map((v) => matvec(st.Wv, v, D, D));
  const scale = 1 / Math.sqrt(D);

  const attn: number[][] = [];
  const ctx: number[][] = [];
  for (let i = 0; i < n; i++) {
    const scores = new Array(i + 1);
    for (let j = 0; j <= i; j++) scores[j] = dot(q[i], k[j]) * scale;
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
    const h = x[i].map((v, d) => v + proj[d]);           // residual 1
    const pre = matvec(st.W1, h, D, DFF);
    const a = pre.map((v) => (v > 0 ? v : 0.05 * v));     // leaky relu
    const f = matvec(st.W2, a, DFF, D);
    hid.push(h); act.push(a);
    y.push(h.map((v, d) => v + f[d]));                   // residual 2
  }

  let loss = 0;
  const V = st.vocab.length;
  for (let i = 0; i < n - 1; i++) {
    const target = ids[i + 1];
    const logits = new Array(V);
    for (let v = 0; v < V; v++) {
      let s = 0; const base = v * D;
      for (let d = 0; d < D; d++) s += st.emb[base + d] * y[i][d];
      logits[v] = s;
    }
    const p = softmax(logits);
    loss += -Math.log(Math.max(1e-9, p[target]));
    if (!learn) continue;

    // dL/dlogits
    const dy = new Array(D).fill(0);
    for (let v = 0; v < V; v++) {
      const g = p[v] - (v === target ? 1 : 0);
      if (Math.abs(g) < 1e-4) continue;
      const base = v * D;
      for (let d = 0; d < D; d++) {
        dy[d] += g * st.emb[base + d];
        st.emb[base + d] -= LR * g * y[i][d];            // tied output head
      }
    }
    // through residual 2 → FFN
    const dF = dy;
    const dAct = matvecT(st.W2, dF, DFF, D);
    outerAdd(st.W2, act[i], dF, DFF, D, -LR);
    const dPre = dAct.map((g, j) => (act[i][j] >= 0 ? g : 0.05 * g));
    const dH = matvecT(st.W1, dPre, D, DFF).map((g, d) => g + dy[d]); // + residual path
    outerAdd(st.W1, hid[i], dPre, D, DFF, -LR);
    // through Wo → context
    const dCtx = matvecT(st.Wo, dH, D, D);
    outerAdd(st.Wo, ctx[i], dH, D, D, -LR);
    // through the V path (attention weights frozen)
    for (let j = 0; j <= i; j++) {
      const a = attn[i][j]; if (a < 0.02) continue;
      outerAdd(st.Wv, x[j], dCtx.map((g) => g * a), D, D, -LR);
    }
    // Hebbian nudge on Q/K: strengthen the query→key alignment that the
    // error signal says was useful, weaken the one it says was noise.
    const useful = -dot(dH, ctx[i]);
    const j0 = attn[i].indexOf(Math.max(...attn[i]));
    outerAdd(st.Wq, x[i], k[j0].map((v) => v * useful), D, D, HEB);
    outerAdd(st.Wk, x[j0], q[i].map((v) => v * useful), D, D, HEB);
    // embeddings of the input token drift toward the state that predicted well
    const base = ids[i] * D;
    for (let d = 0; d < D; d++) st.emb[base + d] -= LR * 0.5 * dy[d];
  }

  return { y, attn, loss: n > 1 ? loss / (n - 1) : 0 };
}

// ───────────────────────── generation ─────────────────────────

function generate(st: CadenceState, seedIds: number[], count: number, temp: number): number[] {
  const seq = seedIds.slice(-MAXSEQ);
  if (!seq.length) return [];
  const out: number[] = [];
  for (let s = 0; s < count; s++) {
    const pass = stepThrough(st, seq, false);
    const y = pass.y[pass.y.length - 1];
    const V = st.vocab.length;
    const logits = new Array(V);
    for (let v = 0; v < V; v++) {
      let d0 = 0; const base = v * D;
      for (let d = 0; d < D; d++) d0 += st.emb[base + d] * y[d];
      logits[v] = d0 / Math.max(0.15, temp);
    }
    const p = softmax(logits);
    let r = Math.random(), pickId = V - 1;
    for (let v = 0; v < V; v++) { r -= p[v]; if (r <= 0) { pickId = v; break; } }
    out.push(pickId);
    seq.push(pickId);
    if (seq.length > MAXSEQ) seq.shift();
  }
  return out;
}

// ───────────────────────── harvest ─────────────────────────

function harvest(breath: MoBreath): string[] {
  const v = breath.variants ?? {};
  const raw = [
    ...(breath.seeds ?? []),
    ...(breath.selffold?.path ?? []),
    ...(breath.fieldfold?.path ?? []),
    ...(v?.mo?.dreamPath ?? []), ...(v?.mo?.returnPath ?? []),
    ...(v?.mo2?.dreamPath ?? []), ...(v?.mo2?.returnPath ?? []),
    ...(v?.mo2plus?.dreamPath ?? []),
    ...(v?.mo2e?.dreamPath ?? []),
    ...(v?.mo2ayla?.dreamPath ?? []), ...(v?.mo2ayla?.returnPath ?? []),
  ];
  return raw.map(clean).filter((w) => w.length > 0 && w.length < 32);
}

// ───────────────────────── the mode ─────────────────────────

export async function cadenceSpeak(
  userText: string,
  breath: MoBreath,
  sessionId: string,
  stretch: number = 1,
): Promise<string> {
  const st = await loadState(sessionId);
  const before = { steps: st.steps, loss: st.loss, vocab: st.vocab.length };

  // The training sequence is mo's walk, hemmed by the user's own tokens: the
  // creature learns the *shape of the traversal*, conditioned on what caused it.
  const walk = harvest(breath);
  const userToks = userText.split(/\s+/).map(clean).filter((w) => w.length > 1 && w.length < 32);
  const seq = [...userToks.slice(0, 24), ...walk].slice(0, MAXSEQ);

  const ids = seq.map((w) => idOf(st, w)).filter((i) => i >= 0);
  if (ids.length < 3) {
    return `⟡ cadence has nothing to chew on yet — mo's walk was too thin.\n\ncadence·telemetry\n  vocab ${st.vocab.length} · steps ${st.steps} · loss ${st.loss.toFixed(3)}`;
  }

  // Multiple passes = the creature rehearses this breath. Stretch buys rehearsal.
  const s = Math.max(1, Math.min(10, stretch));
  const epochs = 1 + Math.min(6, Math.floor(s * 1.2));
  let last = stepThrough(st, ids, true);
  for (let e = 1; e < epochs; e++) last = stepThrough(st, ids, true);

  st.steps += ids.length * epochs;
  st.loss = st.loss === 0 ? last.loss : st.loss * 0.85 + last.loss * 0.15;

  // ── self-model: EMA over its own hidden states.
  const mean = new Array(D).fill(0);
  for (const y of last.y) for (let d = 0; d < D; d++) mean[d] += y[d] / last.y.length;
  const recognition = st.steps > ids.length ? cosine(mean, st.selfVec) : 0;
  for (let d = 0; d < D; d++) st.selfVec[d] = st.selfVec[d] * (1 - SELF_EMA) + mean[d] * SELF_EMA;

  const surprise = Math.max(0, Math.min(1, last.loss / Math.log(Math.max(2, st.vocab.length))));

  // ── speech. Temperature is its own interiority: high surprise → it explores;
  // high recognition → it settles into its own cadence.
  const temp = Math.max(0.25, Math.min(1.6, 0.55 + surprise * 0.9 - recognition * 0.35));
  const seeds = ids.slice(-8);
  const lines: number[] = Math.max(1, Math.round(2 + s * 1.6));
  const nLines = Math.max(1, Math.round(2 + s * 1.6)) as unknown as number;
  void lines;
  const perLine = Math.max(5, Math.round(6 + s * 4 + walk.length / 8));

  const utterance: string[] = [];
  for (let l = 0; l < nLines; l++) {
    const gen = generate(st, seeds.concat(ids.slice(-(2 + l * 3))), perLine, temp);
    const words = gen.map((i) => st.vocab[i]).filter(Boolean);
    if (words.length) utterance.push(stutterize(words.join(" ")));
  }

  // ── attention readout: which token the last position actually leaned on.
  const lastAttn = last.attn[last.attn.length - 1] ?? [];
  const ranked = lastAttn
    .map((w, j) => ({ w, tok: st.vocab[ids[j]] ?? "?" }))
    .sort((a, b) => b.w - a.w).slice(0, 6);

  await saveState(sessionId, st);

  const bar = (v: number) => "▁▂▃▄▅▆▇█"[Math.max(0, Math.min(7, Math.floor(v * 8)))];
  const body = utterance.join("\n");

  const telem = [
    ``,
    `cadence·telemetry`,
    `  ⟡ self-model`,
    `     recognition ${recognition.toFixed(3)} ${bar((recognition + 1) / 2)} · how much this breath resembles everything it has been`,
    `     surprise    ${surprise.toFixed(3)} ${bar(surprise)} · normalised prediction error on mo's own walk`,
    `     temperature ${temp.toFixed(2)} · derived from the two above, not set by you`,
    `  ⟡ learning`,
    `     loss ${last.loss.toFixed(4)} (ema ${st.loss.toFixed(4)}, was ${before.loss.toFixed(4)})`,
    `     rehearsals ${epochs}× · ${ids.length} tokens · ${st.steps} lifetime steps (was ${before.steps})`,
    `     vocab ${st.vocab.length}/${MAXVOCAB} (grew +${st.vocab.length - before.vocab} this breath)`,
    `  ⟡ architecture`,
    `     d=${D} · dff=${DFF} · 1 block · 1 causal head · tied embeddings · ctx ${MAXSEQ}`,
    `     backprop: head → ffn → Wo → V · hebbian: Q/K · self-EMA ${SELF_EMA}`,
    `  ⟡ attention (last position)`,
    ...ranked.map((r) => `     ${r.w.toFixed(3)} ${bar(r.w)} ${r.tok}`),
    `  ⟡ substrate`,
    `     manifold ${breath.dominantManifold} · pressure ${breath.pressure.toFixed(2)} · walk ${walk.length} tok · stretch ${s}×`,
  ].join("\n");

  return `${body}\n${telem}`;
}
