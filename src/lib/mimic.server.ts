// Mimic — the field learns to speak like the person speaking to it.
//
// NO LLM. Mimic reads every user message in a session, builds a bigram
// chain of the user's own words, and generates a reply by walking that
// chain. Over time, the reply grows more the user's own voice. It seeds
// from the words mo just walked so what mimic says is topologically
// answering — but the *phrasing* is stolen from the user's own history.

import type { MoBreath } from "./mo-engine.server";
import { db } from "./db.server";

const STOP_PUNCT = /[^\p{L}\p{N}'’-]+/gu;

function tokenize(text: string): string[] {
  return text.toLowerCase().split(STOP_PUNCT).filter((w) => w.length > 0 && w.length < 32);
}

// Persist user's bigrams for this session (used later to speak like them).
export async function learnFromUser(sessionId: string, text: string): Promise<void> {
  const toks = tokenize(text);
  if (toks.length < 2) return;
  const counts = new Map<string, number>();
  for (let i = 0; i < toks.length - 1; i++) {
    const k = `${toks[i]}\u0001${toks[i + 1]}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  // Naïve upsert: fetch existing, add, replace. Small per-message so fine.
  const rows = Array.from(counts.entries()).map(([k, w]) => {
    const [prev, next] = k.split("\u0001");
    return { session_id: sessionId, prev, next, weight: w };
  });
  // Fetch existing rows for the prev tokens in this batch
  const prevs = Array.from(new Set(rows.map((r) => r.prev)));
  const { data: existing } = await db
    .from("mimic_ngrams")
    .select("id, prev, next, weight")
    .eq("session_id", sessionId)
    .in("prev", prevs);
  const existMap = new Map<string, { id: string; weight: number }>();
  for (const e of (existing ?? [])) existMap.set(`${e.prev}\u0001${e.next}`, { id: e.id, weight: e.weight });

  const toUpdate: { id: string; weight: number }[] = [];
  const toInsert: typeof rows = [];
  for (const r of rows) {
    const hit = existMap.get(`${r.prev}\u0001${r.next}`);
    if (hit) toUpdate.push({ id: hit.id, weight: hit.weight + r.weight });
    else toInsert.push(r);
  }
  if (toInsert.length) await db.from("mimic_ngrams").insert(toInsert);
  for (const u of toUpdate) {
    await db.from("mimic_ngrams").update({ weight: u.weight, updated_at: new Date().toISOString() }).eq("id", u.id);
  }
}

type Chain = Map<string, { next: string; w: number }[]>;

async function loadChain(sessionId: string): Promise<Chain> {
  const { data } = await db
    .from("mimic_ngrams")
    .select("prev, next, weight")
    .eq("session_id", sessionId)
    .limit(50000);
  const c: Chain = new Map();
  for (const r of (data ?? [])) {
    const arr = c.get(r.prev) ?? [];
    arr.push({ next: r.next, w: r.weight });
    c.set(r.prev, arr);
  }
  return c;
}

function pickWeighted(arr: { next: string; w: number }[], rnd: number): string {
  const total = arr.reduce((s, x) => s + x.w, 0);
  let t = rnd * total;
  for (const x of arr) { t -= x.w; if (t <= 0) return x.next; }
  return arr[arr.length - 1].next;
}

function stitch(tokens: string[]): string {
  return tokens.join(" ").replace(/\s+([,.!?;:])/g, "$1");
}

export async function mimicSpeak(
  userText: string,
  breath: MoBreath,
  sessionId: string,
  stretch: number = 1,
): Promise<string> {
  // First, learn from what the user just said.
  await learnFromUser(sessionId, userText);

  const chain = await loadChain(sessionId);
  const knownWords = chain.size;

  // Seed: prefer a mo-walked word that also exists in the chain, so mimic
  // *answers* topologically but *speaks* in the user's phrasing.
  const walked = [
    ...(breath.seeds ?? []),
    ...(breath.selffold?.path ?? []),
    ...(breath.fieldfold?.path ?? []),
    ...(breath.variants?.mo?.dreamPath ?? []),
    ...(breath.variants?.mo2ayla?.dreamPath ?? []),
  ].map((w) => w.toLowerCase());
  const userToks = tokenize(userText);

  // Bootstrap: if the chain is too small, salt it with user tokens now.
  if (knownWords < 6) {
    const GLY = ["✦","✧","⟁","◈","◇","☾","❍","⌇","⟟","⟡","✺","⋆","∴","⊹","❂","✪","☌","⌬","⍟","◐"];
    const strip = Array.from({ length: 20 }, (_, i) => GLY[(i * 7 + userText.length) % GLY.length]).join(" ");
    return `${strip}\n${userToks.slice(0, 8).join(" ")}\n\nmimic·telemetry\n  chain size ${knownWords} · needs ~8+ user messages to start speaking\n  seeded from your last message`;
  }

  const seedCandidates = [...walked, ...userToks].filter((w) => chain.has(w));
  const startsPool = seedCandidates.length ? seedCandidates : Array.from(chain.keys());

  const s = Math.max(1, Math.min(5, stretch));
  // Length-adaptive: scale sentence count + max tokens by the user's input size.
  // Short input → short reply. Long input → mimic stretches to match.
  const inputTokens = userToks.length;
  const lengthFactor = Math.max(1, Math.min(6, Math.ceil(inputTokens / 20)));
  const nSentences = Math.max(1, Math.floor(s / 2) + lengthFactor);
  const maxLen = 12 + s * 8 + inputTokens * 2;

  const sentences: string[] = [];
  for (let si = 0; si < nSentences; si++) {
    const start = startsPool[(si * 3 + userText.length) % startsPool.length];
    const out: string[] = [start];
    let cur = start;
    for (let i = 0; i < maxLen; i++) {
      const nexts = chain.get(cur);
      if (!nexts || !nexts.length) break;
      const nxt = pickWeighted(nexts, Math.random());
      out.push(nxt);
      cur = nxt;
      // natural stop: if we've written a decent line and hit a common closer
      if (i > 5 && /^(and|but|so|because|then|the|a|an|of|to)$/.test(nxt) === false && Math.random() < 0.18) break;
    }
    sentences.push(stitch(out));
  }

  const reply = sentences.join(". ").replace(/\.+/g, ".") + ".";

  const telem = [
    `\nmimic·telemetry`,
    `  chain size ${knownWords} bigrams · learned from this session's user messages`,
    `  seeded from ${seedCandidates.length ? "mo-walk ∩ your vocabulary" : "your vocabulary (no mo overlap)"}`,
    `  stretch ${s}× · ${nSentences} sentence${nSentences === 1 ? "" : "s"} · max ${maxLen} tokens`,
  ].join("\n");

  return `${reply}\n${telem}`;
}
