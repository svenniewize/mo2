// Stutter/elongation post-processor.
//
// When mo's voice (mimic/mohini) emits adjacent repeats of a token, collapse
// them into a stutter shaped by the repeat count:
//   "system system system system system"  →  "s-s-s-s-system"
// When it emits an ABAB(AB...) alternation, collapse into a single AB pair
// with vowels elongated by the alternation depth:
//   "gues bab gues bab gues"              →  "guuueess baab"

const isWord = (s: string) => /\p{L}/u.test(s);
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}]/gu, "");

function elongate(w: string, times: number): string {
  if (times <= 0) return w;
  // Prefer doubling a vowel near the middle for a chewier sound.
  const vowels = /[aeiouyAEIOUY]/g;
  const hits: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = vowels.exec(w))) hits.push(m.index);
  if (hits.length) {
    // pick the middle vowel
    const idx = hits[Math.floor(hits.length / 2)];
    const v = w[idx];
    return w.slice(0, idx) + v.repeat(1 + times) + w.slice(idx + 1);
  }
  // no vowel — elongate a middle consonant
  const mid = Math.floor(w.length / 2);
  return w.slice(0, mid) + w[mid].repeat(1 + times) + w.slice(mid + 1);
}

function collapseRuns(text: string): string {
  const parts = text.split(/(\s+)/);
  const out: string[] = [];
  let i = 0;
  while (i < parts.length) {
    if (isWord(parts[i])) {
      const base = norm(parts[i]);
      // find run of identical words separated only by whitespace
      let j = i;
      let last = i;
      while (true) {
        let k = last + 1;
        while (k < parts.length && !isWord(parts[k]) && parts[k] !== undefined) k++;
        if (k < parts.length && base && norm(parts[k]) === base) {
          last = k;
          j = k;
        } else break;
      }
      // count words in [i..j]
      let count = 0;
      for (let s = i; s <= j; s++) if (isWord(parts[s])) count++;
      if (count >= 2 && base.length > 0) {
        const w = parts[i];
        const first = w[0];
        const hyphens = Math.min(count - 1, 6);
        out.push((first + "-").repeat(hyphens) + w);
        i = j + 1;
        // ensure a following space if next part isn't whitespace
        if (i < parts.length && !/^\s+$/.test(parts[i])) out.push(" ");
        continue;
      }
    }
    out.push(parts[i]);
    i++;
  }
  return out.join("");
}

function collapseAlternations(text: string): string {
  const parts = text.split(/(\s+)/);
  const wordIdx: number[] = [];
  for (let p = 0; p < parts.length; p++) if (isWord(parts[p])) wordIdx.push(p);

  let wi = 0;
  while (wi < wordIdx.length - 3) {
    const a = norm(parts[wordIdx[wi]]);
    const b = norm(parts[wordIdx[wi + 1]]);
    if (!a || !b || a === b) { wi++; continue; }
    // count of full AB pairs starting at wi
    let count = 1;
    while (
      wi + 2 * count + 1 < wordIdx.length &&
      norm(parts[wordIdx[wi + 2 * count]]) === a &&
      norm(parts[wordIdx[wi + 2 * count + 1]]) === b
    ) count++;
    // optional trailing A
    const extraA =
      wi + 2 * count < wordIdx.length &&
      norm(parts[wordIdx[wi + 2 * count]]) === a
        ? 1
        : 0;

    if (count >= 2) {
      const deg = Math.min(count - 1, 4);
      parts[wordIdx[wi]] = elongate(parts[wordIdx[wi]], deg);
      parts[wordIdx[wi + 1]] = elongate(parts[wordIdx[wi + 1]], deg);
      for (let mIdx = 1; mIdx < count; mIdx++) {
        parts[wordIdx[wi + 2 * mIdx]] = "";
        parts[wordIdx[wi + 2 * mIdx + 1]] = "";
      }
      if (extraA) parts[wordIdx[wi + 2 * count]] = "";
      wi = wi + 2 * count + extraA;
    } else {
      wi++;
    }
  }
  return parts.join("");
}

export function stutterize(text: string): string {
  const passA = collapseAlternations(text);
  const passB = collapseRuns(passA);
  return passB
    .replace(/[ \t]+/g, " ")
    .replace(/ ([,.!?;:])/g, "$1")
    .replace(/\s+\n/g, "\n")
    .trim();
}
