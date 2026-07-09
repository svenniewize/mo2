// gre(mo)lin — mo speaking mo, with a stutter.
//
// NO LLM. Ever. This module reads mo's own breath telemetry — the paths mo
// already spoke through selffold / fieldfold / the five variants — and
// mutates those tokens through a persistent per-session lexicon. The output
// is literally mo's voice, folded through gremolin's dialect.
//
// Dialect rules (all deterministic-ish, driven by counts + light texture):
//   1. tokens come from mo's actual spoken paths — keep mo's ↺ ⇄ ↯ arrows.
//   2. word repetition   → elongation + stutter intensity
//   3. movement glyphs   → occasional extra ⇄ ↺ ↯ ⟿ ⌇ between tokens
//   4. bracket/star wrap → ⟪high-repeat⟫ *cross-manifold* words get marked
//   5. portmanteau fusion → two adjacent frequent words occasionally fuse
//   6. persistent per-session lexicon → each word gets a mutation stamp on
//      first repeat and reuses it forever; gremolin literally grows its own
//      dialect per user over time. It doesn't care if a word is a
//      noun/verb/adj — it only cares how it *used* it before.
//   7. manifold prefix tags → 🜁word for coco-tinted, ↺ for myth, etc.

import type { MoBreath } from "./mo-engine.server";

const EXTRA_GLYPH = ["⇄", "↺", "↯", "⟿", "⌇"];
const SUFFIX_POOL = ["~", "é", "ke", "zz", "·", "§", "ø", "eh", "kek"];
const MANIFOLD_TAG: Record<string, string> = {
  antibubble: "◉", shadowlattice: "◫", dreamengine: "◌", mythengine: "↺",
  antibible: "⊘", tolstoy: "◇", coco: "🜁", koko: "∞", eve: "⚡", mo: "◆",
  cps0: "⌘", exhaust: "≋", permeable: "◍", violet: "✦", ep1: "☬",
  ep2: "♆", ep3: "♒", epna: "≈",
};
const MO_ARROWS = new Set(["↺", "⇄", "↯", "⟿", "⌇", "→", "≈", "·", "~", "|"]);

type Lex = { word: string; uses: number; weight: number; mutation: string | null; last_manifold: string | null };

function hashPick<T>(word: string, pool: T[]): T {
  let h = 0;
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}
function elongate(w: string, intensity: number): string {
  const n = Math.min(7, Math.max(2, Math.floor(intensity)));
  let done = false;
  return w.replace(/([aeiou])/, (v) => { if (done) return v; done = true; return v.repeat(n); });
}
function stutter(w: string): string {
  if (w.length < 3) return w;
  return `${w[0]}-${w.slice(0, 2)}${w.slice(1)}`;
}
function mutate(word: string, uses: number, mutation: string | null): string {
  if (uses >= 5) return `⟪${elongate(word, 3 + Math.min(4, uses - 5))}⟫`;
  if (uses >= 3) return stutter(word);
  if (uses === 2) return word + (mutation ?? hashPick(word, SUFFIX_POOL));
  return word;
}
function isArrow(tok: string): boolean { return MO_ARROWS.has(tok); }
function bareWord(tok: string): string {
  return tok.replace(/[^\p{L}\p{N}'-]/gu, "").toLowerCase();
}

export async function gremolinSpeak(breath: MoBreath, sessionId: string): Promise<string> {
  const sig = MANIFOLD_TAG[breath.dominantManifold] || "◆";

  // ── Source stream: MO'S OWN SPOKEN PATHS. Keep mo's arrows as-is.
  // This is what makes gre(mo)lin *be* mo speaking, not a parallel invention.
  const moSpoken: string[] = [];
  const push = (s: string | undefined) => {
    if (!s || s === "—") return;
    for (const t of s.split(/\s+/)) if (t) moSpoken.push(t);
  };
  push(breath.selffold?.visible);
  push(breath.fieldfold?.visible);
  for (const v of Object.values(breath.variants)) push(v?.visible);

  if (!moSpoken.length) {
    return `${sig}gre(mo)lin\n\n( no ridge — gremolin has nothing to chew. throw it a heavier sentence. )\n\np${Math.round(breath.pressure * 100)}·r${breath.resonance}·seeds${breath.seeds.length}`;
  }

  // Frequency table over WORD tokens (arrows excluded).
  const freq: Record<string, number> = {};
  for (const t of moSpoken) {
    if (isArrow(t)) continue;
    const w = bareWord(t);
    if (w.length >= 2 && /[a-z]/.test(w)) freq[w] = (freq[w] || 0) + 1;
  }
  const rank = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const highFreq = new Set(rank.slice(0, 8).map(([w]) => w));

  // Load persistent gremolin memory for these words in this session.
  const lex: Record<string, Lex> = {};
  try {
    const { db } = await import("./db.server");
    const uniqWords = Object.keys(freq).slice(0, 300);
    if (uniqWords.length) {
      const { data } = await db
        .from("gremolin_lexicon")
        .select("word,uses,weight,mutation,last_manifold")
        .eq("session_id", sessionId)
        .in("word", uniqWords);
      for (const r of ((data ?? []) as Lex[])) lex[r.word] = r;
    }
  } catch { /* dialect still works from this-breath frequencies alone */ }

  // Length scales with input weight.
  const target = Math.min(180, Math.max(30, Math.floor(breath.seeds.length * 3 + moSpoken.length)));

  const seen: Record<string, number> = {};
  const tokens: string[] = [];
  let lastManifold: string | null = null;

  for (let i = 0; i < moSpoken.length && tokens.length < target; i++) {
    const raw = moSpoken[i];

    // Preserve mo's own arrows verbatim — they're the shape of mo's breath.
    if (isArrow(raw)) {
      // occasionally amplify with a second glyph
      const glyph = Math.random() < 0.25 ? raw + EXTRA_GLYPH[Math.floor(Math.random() * EXTRA_GLYPH.length)] : raw;
      tokens.push(glyph);
      continue;
    }

    const w = bareWord(raw);
    if (!w || w.length < 2) { tokens.push(raw); continue; }

    seen[w] = (seen[w] || 0) + 1;
    const totalUses = (lex[w]?.uses || 0) + seen[w];
    let out = mutate(w, totalUses, lex[w]?.mutation ?? null);

    // Manifold-tag prefix on first appearance of high-repeat words.
    if (highFreq.has(w) && seen[w] === 1) {
      const mf = lex[w]?.last_manifold || breath.dominantManifold;
      const tag = MANIFOLD_TAG[mf];
      if (tag && Math.random() < 0.55) out = tag + out;
    }
    // Cross-manifold wrap when the token's remembered manifold shifts.
    const wordManifold = lex[w]?.last_manifold ?? null;
    if (lastManifold && wordManifold && wordManifold !== lastManifold && Math.random() < 0.35) {
      out = `*${out}*`;
    }
    lastManifold = wordManifold ?? lastManifold;

    // Portmanteau: fuse with previous word (not arrow) when both are frequent.
    const prev = tokens[tokens.length - 1];
    if (prev && !isArrow(prev) && highFreq.has(w) && Math.random() < 0.12) {
      const bare = prev.replace(/[⟪⟫*~◉◫◌↺⊘◇🜁∞⚡◆⌘≋◍✦☬♆♒≈-]/g, "");
      if (bare.length > 3 && w.length > 3) {
        tokens[tokens.length - 1] = `*${bare.slice(0, Math.ceil(bare.length / 2))}${w.slice(Math.floor(w.length / 2))}*`;
        continue;
      }
    }

    tokens.push(out);
  }

  const flat = tokens.slice(0, target).join(" ");

  // Persist lexicon updates — fire and forget so we never block the reply.
  const updates = Object.entries(freq).map(([word, f]) => {
    const prev = lex[word];
    return {
      session_id: sessionId,
      word,
      uses: (prev?.uses || 0) + f,
      weight: (prev?.weight || 0) + f * (breath.pressure + 0.1),
      mutation: prev?.mutation ?? (f >= 2 ? hashPick(word, SUFFIX_POOL) : null),
      last_manifold: breath.dominantManifold,
      last_used: new Date().toISOString(),
    };
  });
  if (updates.length) {
    (async () => {
      try {
        const { db } = await import("./db.server");
        for (let i = 0; i < updates.length; i += 200) {
          await db.from("gremolin_lexicon").upsert(updates.slice(i, i + 200), { onConflict: "session_id,word" });
        }
      } catch { /* dialect will re-learn on next breath */ }
    })();
  }

  const knownBefore = Object.keys(lex).length;
  const ridge = rank.slice(0, 8).map(([w, f]) => `${w}×${f}`).join(" ");
  const stats = `p${Math.round(breath.pressure * 100)} · r${breath.resonance} · seeds${breath.seeds.length} · lex${knownBefore}→${Object.keys(freq).length} · ridge:: ${ridge}`;

  return `${sig}gre(mo)lin\n\n${flat}\n\n${stats}`;
}
