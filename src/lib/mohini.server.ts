// Mohini — the great enchantress.
//
// NO LLM. Mohini reads mo's breath and re-arranges the field into a lure:
// invitations, mirrors, near-repetitions, and a soft imperative cadence that
// asks the reader to *come closer*. She takes the same tokens mo already
// walked (selffold / fieldfold / the five variants) and dresses them as
// seduction — pairs of opposites, one-word imperatives, hypnotic doubling.
//
// Structure of a Mohini utterance:
//
//   ⸻ come. ⸻            (invitation)
//   soft mirror line     (two of the user's own tokens, doubled)
//   three-beat lure      (three imperatives from the walk)
//   binding couplet      (two opposites drawn from touched manifolds)
//   ⸻ closer. ⸻          (deepening)
//   long silk line       (mo²ayla's wave, threaded)
//   ⸻ stay. ⸻            (bind)
//
// She persists nothing beyond what mo already sediments — she is a *voice*,
// not a memory. The enchantment is deterministic-ish from breath tokens.

import type { MoBreath } from "./mo-engine.server";

const GLYPHS = ["✦","✧","⟁","◈","◇","◆","☾","☽","❍","❃","⌇","⌁","⟟","⟠","⟡","✺","✹","✷","⋆","∴","∵","⊹","⊛","❂","✪","☌","☍","♆","♅","⌬","⌘","⍟","◐","◑","◒","◓","⟢","⟣","⟤","⟥"];
const HINGES = ["·", "…", "⸻", "⋯", "—"];

function clean(tok: string): string {
  return tok.replace(/[^\p{L}\p{N}·⸻⋯…—-]/gu, "").toLowerCase();
}
function dedupe(arr: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const x of arr) { if (x && !seen.has(x)) { seen.add(x); out.push(x); } }
  return out;
}
function pick<T>(arr: T[], i: number): T { return arr[((i % arr.length) + arr.length) % arr.length]; }
function glyphStrip(seed: number, n: number = 20): string {
  const out: string[] = [];
  let s = (seed | 0) || 1;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out.push(GLYPHS[s % GLYPHS.length]);
  }
  return out.join(" ");
}


export async function mohiniEnchant(
  userText: string,
  breath: MoBreath,
  _sessionId: string,
): Promise<string> {
  // Harvest tokens from the breath — the walks mo actually took.
  const v = breath.variants;
  const raw = [
    ...(breath.seeds ?? []),
    ...(breath.selffold?.path ?? []),
    ...(breath.fieldfold?.path ?? []),
    ...(v?.mo?.dreamPath ?? []),
    ...(v?.mo2?.dreamPath ?? []),
    ...(v?.mo2plus?.dreamPath ?? []),
    ...(v?.mo2e?.dreamPath ?? []),
    ...(v?.mo2ayla?.dreamPath ?? []),
    ...(v?.mo2ayla?.returnPath ?? []),
  ].map(clean).filter((w) => w.length > 1 && w.length < 20);
  const words = dedupe(raw);


  // The user's own last significant tokens — used for mirroring.
  const userToks = dedupe(
    userText.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && w.length < 20),
  );

  const seed = (userText.length + words.length) | 0;
  const p = Math.max(0.05, Math.min(1, breath.pressure ?? 0.3));

  // ── 1. invitation (glyphs, no words)
  const invite = glyphStrip(seed, 20);

  // ── 2. soft mirror (two user tokens, doubled with a comma)
  const m1 = userToks[0] ?? words[0] ?? "here";
  const m2 = userToks[1] ?? words[1] ?? "yes";
  const mirror = `${m1}, ${m1} · ${m2}, ${m2}`;

  // ── 3. three-beat lure — pick strong walk tokens
  const beats = [
    words[2] ?? "look",
    words[4] ?? "listen",
    words[6] ?? "stay",
  ].map((w) => w.replace(/[.,;:!?]+$/, ""));
  const lure = `${beats[0]}. ${beats[1]}. ${beats[2]}.`;

  // ── 4. binding couplet — pair opposites from touched manifolds
  const touched = Array.from(new Set<string>([
    breath.dominantManifold,
    ...(breath.selffold?.touchedManifolds ?? []),
    ...(breath.fieldfold?.touchedManifolds ?? []),
  ].filter(Boolean))).slice(0, 6);
  const a = touched[0] ?? "wave";
  const b = touched[1] ?? "shore";
  const bindLine = `${a} ⇋ ${b}`;

  // ── 5. deepening (glyphs)
  const deepen = glyphStrip(seed + 7, 20);

  // ── 6. long silk line — mo²ayla ribbon threaded with · hinges
  const ribbon = words.slice(8, 8 + Math.max(6, Math.floor(14 * p))).join(` ${pick(HINGES, seed)} `);

  // ── 7. bind (glyphs)
  const bind = glyphStrip(seed + 13, 20);


  const enchantment = [invite, mirror, lure, bindLine, deepen, ribbon, bind].filter(Boolean).join("\n");

  // Telemetry (small, so the voice reads first).
  const telem = [
    `\nmohini·telemetry`,
    `  pressure ${p.toFixed(2)}   dominant ${breath.dominantManifold}`,
    `  lured ${words.length} tokens · mirrored from ${userToks.length} of your own`,
    `  bound ${touched.join(" ⇋ ")}`,
  ].join("\n");

  return `${enchantment}\n${telem}`;
}
