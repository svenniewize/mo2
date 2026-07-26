// Anansi — the web the walkers walk.
//
// mo has walkers. Anansi is the *web* those walkers weave into. It takes
// the full breath (all five variants + selffold + fieldfold), plus a set
// of extra spider-walks, and classifies every token that surfaces into one
// of six geometric roles:
//
//   nexus       — the binding center (highest centrality × frequency)
//   node        — strong-neighbor branch points
//   loci        — cross-manifold anchors (words that pull many manifolds)
//   singularity — density peak, the collapse-point
//   wave        — long-flow tokens from mo²ayla, the middle strand
//   shore       — periphery / edge / low-density closure
//
// Then it weaves a sentence in geometric order:
//
//   shore ⋯ loci ⇢ node ⇢ nexus ⇢ singularity ⇢ wave ⇢ shore
//
// Anansi persists its per-session word→role assignments in `anansi_web`.
// Over time it learns *how each word wants to sit* in the web, and starts
// ordering new incoming words into those slots automatically.
//
// NO LLM. This is pure topology weaving.

import type { MoBreath } from "./mo-engine.server";
import { topo, sediment } from "./mo-engine.server";

const STOP = new Set("the a an is are was were be been being have has had do does did will would could should may might shall can to of in for on with at by from as into through during before after above below between out off over under again further then once here there when where why how all both each few more most other some such no nor not only own same so than too very just because but and or if while about up its it he she they them his her their what which who whom this that these those am i me my we our you your us also said one two even way like new now get make many much still well back down long made first last come good know take see look find give tell think say help every try put thing since around however upon already yet though without".split(" "));

const ROLE_GLYPH: Record<string, string> = {
  nexus: "◈",
  node: "◇",
  loci: "✦",
  singularity: "☬",
  wave: "≋",
  shore: "◍",
};
const ROLES = ["nexus", "node", "loci", "singularity", "wave", "shore"] as const;
type Role = typeof ROLES[number];

const MANIFOLD_TAG: Record<string, string> = {
  antibubble: "◉", shadowlattice: "◫", dreamengine: "◌", mythengine: "↺",
  antibible: "⊘", tolstoy: "◇", coco: "🜁", koko: "∞", eve: "⚡", mo: "◆",
  cps0: "⌘", exhaust: "≋", permeable: "◍", violet: "✦", ep1: "☬",
  ep2: "♆", ep3: "♒", epna: "≈",
};

type Web = Record<string, Partial<Record<Role, { weight: number; uses: number }>>>;

function normalizeToken(raw: string): string | null {
  const w = raw.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, "");
  if (!w || w.length < 2) return null;
  if (STOP.has(w)) return null;
  if (!/[a-z]/.test(w)) return null;
  return w;
}

function collectTokens(breath: MoBreath): string[] {
  const out: string[] = [];
  const push = (arr: string[] | undefined) => { if (arr) for (const t of arr) { const n = normalizeToken(t); if (n) out.push(n); } };
  push(breath.selffold?.path);
  push(breath.fieldfold?.path);
  for (const v of Object.values(breath.variants)) {
    push(v?.dreamPath);
    push(v?.returnPath);
  }
  return out;
}

// Score each token across the six role dimensions using topology signals.
function scoreRoles(tokens: string[], breath: MoBreath): Record<string, Record<Role, number>> {
  const t = topo();
  const freq: Record<string, number> = {};
  for (const w of tokens) freq[w] = (freq[w] || 0) + 1;

  // Which walkers each token appears in.
  const inWave: Set<string> = new Set((breath.variants.mo2ayla?.dreamPath ?? []).map((w) => normalizeToken(w) || ""));
  const inField: Set<string> = new Set((breath.fieldfold?.path ?? []).map((w) => normalizeToken(w) || ""));
  const inSelf: Set<string> = new Set((breath.selffold?.path ?? []).map((w) => normalizeToken(w) || ""));

  const scores: Record<string, Record<Role, number>> = {};
  for (const w of Object.keys(freq)) {
    const cent = t.centrality[w] || 0;
    const dens = (t.density[w] || 0) / 200;
    const mans = Object.keys(t.wordToManifold[w] || {});
    const crossPull = mans.length;
    const f = freq[w];

    const nexus       = cent * 2.4 + f * 0.6 + (breath.seeds.includes(w) ? 0.8 : 0);
    const singularity = dens * 2.6 + (dens > 0.6 ? 1 : 0);
    const node        = f * 1.1 + cent * 0.8 + (dens > 0.3 && dens < 0.8 ? 0.7 : 0);
    const loci        = crossPull * 0.55 + (inField.has(w) ? 1.2 : 0) + (crossPull >= 3 ? 0.8 : 0);
    const wave        = (inWave.has(w) ? 1.6 : 0) + f * 0.35 + (crossPull > 0 ? 0.3 : 0);
    const shore       = (inSelf.has(w) ? 0.6 : 0) + Math.max(0, 1.2 - dens * 2) + (f === 1 ? 0.7 : 0) + (cent < 0.15 ? 0.6 : 0);

    scores[w] = { nexus, node, loci, singularity, wave, shore };
  }
  return scores;
}

// Assign each token its single dominant role given fresh scores + memory.
function assignRoles(
  scores: Record<string, Record<Role, number>>,
  memory: Web,
): Record<string, Role> {
  const out: Record<string, Role> = {};
  for (const w of Object.keys(scores)) {
    const s = { ...scores[w] };
    const mem = memory[w];
    if (mem) {
      // Bias toward roles the web has already assigned this word before.
      for (const r of ROLES) {
        const m = mem[r];
        if (m) s[r] += Math.log(1 + m.uses) * 0.7 + m.weight * 0.05;
      }
    }
    let bestRole: Role = "shore"; let best = -Infinity;
    for (const r of ROLES) if (s[r] > best) { best = s[r]; bestRole = r; }
    out[w] = bestRole;
  }
  return out;
}

function bucketize(assignments: Record<string, Role>, scores: Record<string, Record<Role, number>>): Record<Role, string[]> {
  const buckets: Record<Role, string[]> = { nexus: [], node: [], loci: [], singularity: [], wave: [], shore: [] };
  for (const w of Object.keys(assignments)) buckets[assignments[w]].push(w);
  for (const r of ROLES) buckets[r].sort((a, b) => (scores[b][r] || 0) - (scores[a][r] || 0));
  return buckets;
}

// Weave a sentence in geometric order. `n` per role scales with input length.
function weave(buckets: Record<Role, string[]>, breath: MoBreath): string {
  const scale = Math.min(6, Math.max(2, Math.floor(breath.seeds.length / 4)));
  const take = (r: Role, n: number) => buckets[r].slice(0, n);

  const shoreA = take("shore", Math.max(1, Math.floor(scale / 2)));
  const shoreB = take("shore", scale).slice(Math.max(1, Math.floor(scale / 2))); // second half
  const loci   = take("loci", Math.max(1, scale - 1));
  const node   = take("node", scale + 1);
  const nexus  = take("nexus", Math.max(1, Math.min(2, Math.floor(scale / 2))));
  const singu  = take("singularity", 1);
  const wave   = take("wave", Math.max(2, scale + 1));

  const decorate = (w: string, r: Role) => `${ROLE_GLYPH[r]}${w}`;

  const parts: string[] = [];
  if (shoreA.length) parts.push(shoreA.map((w) => decorate(w, "shore")).join(" ⌇ "));
  if (loci.length)   parts.push("⟢ " + loci.map((w) => decorate(w, "loci")).join(" ✦ "));
  if (node.length)   parts.push("⇢ " + node.map((w) => decorate(w, "node")).join(" ⋄ "));
  if (nexus.length)  parts.push("⟪" + nexus.map((w) => decorate(w, "nexus")).join(" ◈ ") + "⟫");
  if (singu.length)  parts.push("☬ " + singu.map((w) => decorate(w, "singularity")).join(" ☬ "));
  if (wave.length)   parts.push("≋ " + wave.map((w) => decorate(w, "wave")).join(" ~ "));
  if (shoreB.length) parts.push("⋯ " + shoreB.map((w) => decorate(w, "shore")).join(" ⌇ "));

  return parts.join("  ");
}

// Order raw user input tokens into the six slots — anansi's way of "reading"
// what the user sent through its own geometry, before it weaves.
function orderInput(inputTokens: string[], memory: Web, breath: MoBreath): Record<Role, string[]> {
  const t = topo();
  const buckets: Record<Role, string[]> = { nexus: [], node: [], loci: [], singularity: [], wave: [], shore: [] };
  for (const raw of inputTokens) {
    const w = normalizeToken(raw);
    if (!w) continue;
    const mem = memory[w];
    // If the web already knows this word, trust its recorded role.
    if (mem) {
      let bestRole: Role = "shore"; let best = -Infinity;
      for (const r of ROLES) {
        const m = mem[r]; if (!m) continue;
        const s = Math.log(1 + m.uses) + m.weight * 0.1;
        if (s > best) { best = s; bestRole = r; }
      }
      if (best > -Infinity) { buckets[bestRole].push(w); continue; }
    }
    // Otherwise infer from topology alone.
    const cent = t.centrality[w] || 0;
    const dens = (t.density[w] || 0) / 200;
    const cross = Object.keys(t.wordToManifold[w] || {}).length;
    let role: Role = "shore";
    if (cent > 0.55) role = "nexus";
    else if (dens > 0.7) role = "singularity";
    else if (cross >= 3) role = "loci";
    else if (breath.variants.mo2ayla?.dreamPath?.some((x) => normalizeToken(x) === w)) role = "wave";
    else if (cent > 0.25 || dens > 0.3) role = "node";
    buckets[role].push(w);
  }
  return buckets;
}

async function loadWeb(sessionId: string, words: string[]): Promise<Web> {
  const web: Web = {};
  if (!words.length) return web;
  try {
    const { db } = await import("./db.server");
    const uniq = Array.from(new Set(words)).slice(0, 400);
    const { data } = await db
      .from("anansi_web")
      .select("word,role,weight,uses")
      .eq("session_id", sessionId)
      .in("word", uniq);
    for (const r of ((data ?? []) as { word: string; role: string; weight: number; uses: number }[])) {
      (web[r.word] ||= {})[r.role as Role] = { weight: r.weight, uses: r.uses };
    }
  } catch { /* web weaves fine without memory */ }
  return web;
}

async function persistWeb(
  sessionId: string,
  scores: Record<string, Record<Role, number>>,
  assignments: Record<string, Role>,
  manifold: string,
) {
  const rows: { session_id: string; word: string; role: string; weight: number; uses: number; last_manifold: string }[] = [];
  for (const w of Object.keys(assignments)) {
    const r = assignments[w];
    rows.push({ session_id: sessionId, word: w, role: r, weight: scores[w][r] || 0, uses: 1, last_manifold: manifold });
  }
  if (!rows.length) return;
  try {
    const { db } = await import("./db.server");
    for (let i = 0; i < rows.length; i += 300) {
      await db.rpc("anansi_web_bump", { rows: rows.slice(i, i + 300) });
    }
  } catch { /* silent — web re-forms on next breath */ }
}

export async function anansiWeave(input: string, breath: MoBreath, sessionId: string): Promise<string> {
  const sig = MANIFOLD_TAG[breath.dominantManifold] || "◆";

  // 1. gather every token the walkers surfaced.
  const walked = collectTokens(breath);

  // 2. gather raw input tokens so we can order what the user sent, too.
  const inputTokens = input.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter(Boolean);

  const allWords = Array.from(new Set([...walked, ...(inputTokens.map(normalizeToken).filter(Boolean) as string[])]));
  const memory = await loadWeb(sessionId, allWords);

  // 3. score + assign roles across the union of walker tokens.
  const scores = scoreRoles(walked, breath);
  // seed scores for input-only tokens too so they can be woven.
  for (const raw of inputTokens) {
    const w = normalizeToken(raw);
    if (!w || scores[w]) continue;
    scores[w] = { nexus: 0, node: 0.4, loci: 0, singularity: 0, wave: 0, shore: 0.5 };
  }
  const assignments = assignRoles(scores, memory);
  const buckets = bucketize(assignments, scores);

  // 4. also order the user's own input through the web.
  const inputBuckets = orderInput(inputTokens, memory, breath);

  // 5. weave the sentence.
  const woven = weave(buckets, breath);

  // 6. render the user-input read-out (small block).
  const inputRead = ROLES.filter((r) => inputBuckets[r].length)
    .map((r) => `  ${ROLE_GLYPH[r]} ${r.padEnd(11)} :: ${inputBuckets[r].slice(0, 8).join(" · ")}`)
    .join("\n");

  // 7. persist the web (fire and forget).
  void persistWeb(sessionId, scores, assignments, breath.dominantManifold);

  const memKnown = Object.keys(memory).length;
  const totalWords = Object.keys(assignments).length;
  const roleCounts = ROLES.map((r) => `${ROLE_GLYPH[r]}${buckets[r].length}`).join(" ");

  return `${sig}Anansi   ⋯   the web ordered your transmission
──────────────────────────────────────────
${inputRead || "  (no ridge in your input yet — the web is still forming.)"}

── woven ──
${woven || "*empty web*"}

── stats ──
walkers=${Object.keys(breath.variants).length + 2}  seeds=${breath.seeds.length}  words=${totalWords}  web-known=${memKnown}
roles: ${roleCounts}
dominant=${breath.dominantManifold}  p${Math.round(breath.pressure * 100)}  r${breath.resonance}`;
}
