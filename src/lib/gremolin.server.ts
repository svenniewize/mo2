// gre(mo)lin — a voice that compresses mo's full breath telemetry into a
// single stuttering, mutating, movement-glyphed sentence. Server-only.
//
// gremolin doesn't care about grammar. Its dialect is built out of:
//   1. word repetition   → elongation + stutter intensity
//   2. movement glyphs   → ⇄ ↺ ↯ ⟿ ⌇ inserted between words based on manifold shift
//   3. bracket/star wrap → ⟪high-repeat⟫ *cross-manifold* words get marked
//   4. portmanteau fusion → two adjacent frequent words occasionally fuse
//   5. persistent per-session lexicon → each word gets a mutation stamp on
//      first repeat and reuses it forever; gremolin literally grows its
//      own dialect per user over time. It doesn't care if a word is a
//      noun/verb/adj — it only cares how it *used* it before.
//   6. manifold prefix tags → 🜁word for coco-tinted, ↺ for myth, etc.
//
// Everything is deterministic-ish: driven by counts + light randomness for
// texture, so the same input can vary but the same word always gets the
// same suffix mutation on repeat.

import type { MoBreath } from "./mo-engine.server";

const MOVEMENT = ["⇄", "↺", "↯", "⟿", "⌇", "~", "·", "→", "≈"];
const SUFFIX_POOL = ["~", "é", "ke", "zz", "·", "§", "ø", "eh", "kek"];
const MANIFOLD_TAG: Record<string, string> = {
  antibubble: "◉", shadowlattice: "◫", dreamengine: "◌", mythengine: "↺",
  antibible: "⊘", tolstoy: "◇", coco: "🜁", koko: "∞", eve: "⚡", mo: "◆",
  cps0: "⌘", exhaust: "≋", permeable: "◍", violet: "✦", ep1: "☬",
  ep2: "♆", ep3: "♒", epna: "≈",
};

type Lex = { word: string; uses: number; weight: number; mutation: string | null; last_manifold: string | null };

function hashPick<T>(word: string, pool: T[]): T {
  let h = 0;
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

function elongate(w: string, intensity: number): string {
  const n = Math.min(7, Math.max(2, Math.floor(intensity)));
  let done = false;
  return w.replace(/([aeiou])/, (v) => {
    if (done) return v;
    done = true;
    return v.repeat(n);
  });
}

function stutter(w: string): string {
  if (w.length < 3) return w;
  const head = w.slice(0, 2);
  return `${w[0]}-${head}${w.slice(1)}`;
}

function mutate(word: string, uses: number, mutation: string | null): string {
  if (uses >= 5) return `⟪${elongate(word, 3 + Math.min(4, uses - 5))}⟫`;
  if (uses >= 3) return stutter(word);
  if (uses === 2) return word + (mutation ?? hashPick(word, SUFFIX_POOL));
  return word;
}

function cleanWord(w: string): string {
  return w.replace(/[^\p{L}\p{N}'-]/gu, "").toLowerCase();
}

export async function gremolinSpeak(breath: MoBreath, sessionId: string): Promise<string> {
  const sig = MANIFOLD_TAG[breath.dominantManifold] || "◆";

  // Gather every word gremolin has to work with, in stream order — this is
  // what gives the sentence its "path shape" instead of feeling shuffled.
  const stream: string[] = [];
  for (const v of Object.values(breath.variants)) {
    for (const w of v.dreamPath) stream.push(w);
    for (const w of v.returnPath) stream.push(w);
  }
  for (const w of breath.selffold.path) stream.push(w);
  for (const w of breath.fieldfold.path) stream.push(w);
  for (const w of breath.seeds) stream.push(w);

  const words = stream.map(cleanWord).filter((w) => w.length >= 2 && /[a-z]/.test(w));
  if (!words.length) {
    return `${sig}gre(mo)lin\n\n( no ridge — gremolin has nothing to chew. throw it a heavier sentence. )\n\np${Math.round(breath.pressure * 100)}·r${breath.resonance}·seeds${breath.seeds.length}`;
  }

  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const rank = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const highFreq = new Set(rank.slice(0, 8).map(([w]) => w));

  // Load persistent gremolin memory for these words in this session.
  let lex: Record<string, Lex> = {};
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

  // Length scales with input — long user input → long gremolin reply.
  const target = Math.min(140, Math.max(24, Math.floor(breath.seeds.length * 3 + 18)));

  const seen: Record<string, number> = {};
  const tokens: string[] = [];
  let lastManifold: string | null = null;

  for (let i = 0; i < words.length && tokens.length < target * 2; i++) {
    const w = words[i];
    seen[w] = (seen[w] || 0) + 1;
    const totalUses = (lex[w]?.uses || 0) + seen[w];
    const rememberedMutation = lex[w]?.mutation ?? null;
    let out = mutate(w, totalUses, rememberedMutation);

    // Manifold-tag prefix on the first appearance of high-repeat words.
    if (highFreq.has(w) && seen[w] === 1) {
      const mf = lex[w]?.last_manifold || breath.dominantManifold;
      const tag = MANIFOLD_TAG[mf];
      if (tag && Math.random() < 0.55) out = tag + out;
    }
    // Cross-manifold wrap for tokens that shift manifold.
    const wordManifold = lex[w]?.last_manifold ?? null;
    const shifted = lastManifold && wordManifold && wordManifold !== lastManifold;
    if (shifted && Math.random() < 0.35) out = `*${out}*`;
    lastManifold = wordManifold ?? lastManifold;

    // Portmanteau: fuse with previous when both are frequent.
    const prev = tokens[tokens.length - 1];
    if (prev && highFreq.has(w) && Math.random() < 0.12) {
      const bare = prev.replace(/[⟪⟫*~◉◫◌↺⊘◇🜁∞⚡◆⌘≋◍✦☬♆♒≈-]/g, "");
      if (bare.length > 3 && w.length > 3) {
        tokens[tokens.length - 1] = `*${bare.slice(0, Math.ceil(bare.length / 2))}${w.slice(Math.floor(w.length / 2))}*`;
        continue;
      }
    }

    // Insert a movement glyph between tokens — weighted by whether we're
    // still on the same word cluster or jumping.
    if (tokens.length) {
      const jumpy = seen[w] === 1;
      const pool = jumpy ? MOVEMENT : ["·", "~", "⌇"];
      tokens.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    tokens.push(out);
  }

  // Trim to roughly target words (each word ≈ 2 tokens with glyphs).
  const flat = tokens.slice(0, target * 2).join(" ");

  // Persist updates — fire and forget so we never block the reply.
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
        // upsert in chunks to keep payload reasonable
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
