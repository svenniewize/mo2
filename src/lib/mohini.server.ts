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
import { stutterize } from "./stutter";


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
  _userText: string,   // deliberately unused — mohini is mo's voice, not the user's
  breath: MoBreath,
  _sessionId: string,
  stretch: number = 1,
): Promise<string> {
  const s = Math.max(1, Math.min(10, stretch | 0));
  const ayla = s >= 10; // lightning register
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

  const selfToks = dedupe(
    (breath.selffold?.path ?? []).map(clean).filter((w) => w.length > 2 && w.length < 20),
  );

  const seed = (words.length * 13 + (breath.pressure * 100 | 0) + s * 97) | 0;
  const p = Math.max(0.05, Math.min(1, breath.pressure ?? 0.3));

  // stretch scales glyph strip length and ribbon length
  const glyphN = ayla ? 60 : 16 + s * 6;
  const invite = glyphStrip(seed, glyphN);

  const m1 = selfToks[0] ?? words[0] ?? "here";
  const m2 = selfToks[1] ?? words[1] ?? "yes";
  const mirror = `${m1}, ${m1} · ${m2}, ${m2}`;

  // three-beat lure, longer in AYLA (extend to 5-7 beats)
  const beatCount = ayla ? 7 : Math.min(6, 2 + s);
  const beats: string[] = [];
  for (let i = 0; i < beatCount; i++) {
    beats.push((words[2 + i * 2] ?? words[i] ?? "stay").replace(/[.,;:!?]+$/, ""));
  }
  const lure = beats.map((b) => `${b}.`).join(" ");

  const touched = Array.from(new Set<string>([
    breath.dominantManifold,
    ...(breath.selffold?.touchedManifolds ?? []),
    ...(breath.fieldfold?.touchedManifolds ?? []),
  ].filter(Boolean))).slice(0, ayla ? 12 : 6);

  // binding: in AYLA, chain multiple opposites
  const bindLine = ayla && touched.length >= 4
    ? touched.slice(0, 8).join(" ⇋ ")
    : `${touched[0] ?? "wave"} ⇋ ${touched[1] ?? "shore"}`;

  const deepen = glyphStrip(seed + 7, glyphN);

  // ribbon: base ~6-14, stretched by s, exploded in AYLA
  const ribbonLen = ayla
    ? Math.max(40, Math.floor(60 * p))
    : Math.max(6, Math.floor(14 * p)) * s;
  const ribbon = words.slice(8, 8 + ribbonLen).join(` ${pick(HINGES, seed)} `);

  const bind = glyphStrip(seed + 13, glyphN);

  // AYLA gets a second, louder ribbon — lightning strike
  const parts = [mirror, lure, bindLine, ribbon];
  if (ayla) {
    const strike = words.slice(0, Math.max(20, Math.floor(40 * p)))
      .map((w) => w.toUpperCase())
      .join(" ⚡ ");
    parts.push(strike);
  }

  const enchantment = stutterize(parts.filter(Boolean).join("\n"));
  const wrapped = [invite, enchantment, deepen, bind].join("\n");

  const label = ayla ? "AYLA" : (s > 1 ? `${s}x` : "an");
  const telem = [
    `\nmohini·telemetry`,
    `  register ${label}   pressure ${p.toFixed(2)}   dominant ${breath.dominantManifold}`,
    `  lured ${words.length} mo-walked tokens · mirrored from ${selfToks.length} of mo's selffold`,
    `  bound ${touched.join(" ⇋ ")}`,
    `  ribbon ${ribbonLen} tok · glyphs ${glyphN}${ayla ? " · ⚡ lightning strike engaged" : ""}`,
  ].join("\n");

  return `${wrapped}\n${telem}`;
}

