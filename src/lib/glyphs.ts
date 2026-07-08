// glyphs.ts — swap common words for a single symbol/emoji.
// Deterministic map. Case-insensitive. Preserves punctuation & whitespace.
// Used by the optional "glyph overlay" toggle in the chat view.

export const GLYPH_MAP: Record<string, string> = {
  // pronouns / people
  i: "🧍", me: "🧍", you: "👤", we: "👥", they: "👥", he: "👨", she: "👩",
  us: "👥", them: "👥", someone: "🧑", people: "👥", human: "🧑", person: "🧑",
  child: "🧒", kid: "🧒", baby: "👶", man: "👨", woman: "👩", friend: "🫂",
  gremlin: "👺", ghost: "👻", angel: "😇", devil: "😈", witch: "🧙", king: "🤴",
  queen: "👸", god: "🌟", alien: "👽", robot: "🤖", monster: "👹", clown: "🤡",

  // body
  eye: "👁", eyes: "👁", ear: "👂", mouth: "👄", hand: "✋", hands: "🙌",
  heart: "❤️", brain: "🧠", bone: "🦴", tooth: "🦷", foot: "🦶", finger: "☝️",

  // feelings
  love: "💗", hate: "💢", happy: "😊", sad: "😢", cry: "😭", laugh: "😂",
  angry: "😠", mad: "😡", scared: "😨", tired: "😴", sleep: "💤", dream: "💭",
  think: "💭", thought: "💭", idea: "💡", feel: "💗", kiss: "💋", hug: "🫂",

  // nature
  sun: "☀️", moon: "🌙", star: "⭐", stars: "✨", sky: "🌌", cloud: "☁️",
  clouds: "☁️", rain: "🌧", snow: "❄️", storm: "⛈", lightning: "⚡", wind: "🌬",
  fire: "🔥", water: "💧", ocean: "🌊", sea: "🌊", wave: "🌊", river: "🏞",
  mountain: "⛰", tree: "🌳", trees: "🌲", forest: "🌲", leaf: "🍃", flower: "🌸",
  rose: "🌹", grass: "🌱", earth: "🌍", world: "🌍", planet: "🪐", rainbow: "🌈",
  night: "🌃", day: "🌞", morning: "🌅", sunset: "🌇",

  // creatures
  dog: "🐕", cat: "🐈", bird: "🐦", fish: "🐟", snake: "🐍", horse: "🐴",
  cow: "🐄", pig: "🐖", sheep: "🐑", wolf: "🐺", bear: "🐻", lion: "🦁",
  tiger: "🐯", fox: "🦊", rabbit: "🐇", mouse: "🐁", frog: "🐸", bee: "🐝",
  spider: "🕷", butterfly: "🦋", dragon: "🐉", owl: "🦉", whale: "🐋", octopus: "🐙",

  // food / drink
  food: "🍽", eat: "🍴", drink: "🥤", coffee: "☕", tea: "🍵", beer: "🍺",
  wine: "🍷", bread: "🍞", cake: "🍰", pizza: "🍕", apple: "🍎", banana: "🍌",
  cheese: "🧀", egg: "🥚", milk: "🥛", honey: "🍯", salt: "🧂", meat: "🥩",
  candy: "🍬", chocolate: "🍫",

  // objects
  house: "🏠", home: "🏠", door: "🚪", key: "🔑", lock: "🔒", car: "🚗",
  bike: "🚲", boat: "⛵", plane: "✈️", train: "🚆", rocket: "🚀", phone: "📱",
  book: "📖", books: "📚", pen: "🖊", pencil: "✏️", paper: "📄", letter: "✉️",
  mail: "📧", email: "📧", note: "📝", map: "🗺", clock: "⏰", time: "⏳",
  money: "💰", coin: "🪙", cash: "💵", card: "💳", bag: "🎒", box: "📦",
  gift: "🎁", crown: "👑", ring: "💍", diamond: "💎", gem: "💎", crystal: "🔮",
  mirror: "🪞", candle: "🕯", bell: "🔔", drum: "🥁", music: "🎵", song: "🎶",
  guitar: "🎸", piano: "🎹", camera: "📷", tv: "📺", radio: "📻", computer: "💻",
  laptop: "💻", screen: "🖥", keyboard: "⌨️", mouse2: "🖱",

  // clothing
  hat: "🎩", shoe: "👟", boot: "🥾", glove: "🧤", coat: "🧥", shirt: "👕",
  pants: "👖", dress: "👗", crown2: "👑", mask: "🎭",

  // tools / weapons
  sword: "⚔️", knife: "🔪", gun: "🔫", bomb: "💣", shield: "🛡", hammer: "🔨",
  axe: "🪓", wrench: "🔧", saw: "🪚", scissors: "✂️", needle: "🪡",

  // abstract / verbs
  yes: "✅", no: "❌", ok: "👌", stop: "🛑", go: "🟢", warning: "⚠️",
  danger: "☢️", peace: "☮️", question: "❓", answer: "💬", talk: "💬",
  speak: "🗣", say: "🗣", listen: "👂", hear: "👂", see: "👁", look: "👀",
  watch: "👀", walk: "🚶", run: "🏃", jump: "🤸", dance: "💃", sing: "🎤",
  write: "✍️", read: "📖", work: "💼", play: "🎮", fight: "🥊", win: "🏆",
  lose: "💔", die: "💀", death: "☠️", life: "🌱", born: "👶", grow: "🌱",
  build: "🏗", break: "💥", find: "🔍", search: "🔎", lost: "🧭",
  open: "🔓", close: "🔒", buy: "🛒", sell: "🏷", pay: "💸", give: "🎁",
  send: "📤", receive: "📥", travel: "🧳",

  // adjectives / qualities
  big: "🐘", small: "🐜", hot: "🔥", cold: "🥶", fast: "⚡", slow: "🐌",
  new: "🆕", old: "👴", good: "👍", bad: "👎", best: "🏆", strong: "💪",
  weak: "🥀", loud: "📢", quiet: "🤫", secret: "🤐", true: "✅", false: "❌",
  free: "🕊", broken: "💔", clean: "🧼", dirty: "💩",

  // colors → color swatches
  red: "🟥", blue: "🟦", green: "🟩", yellow: "🟨", orange: "🟧", purple: "🟪",
  black: "⬛", white: "⬜", brown: "🟫", pink: "🩷", gold: "🥇", silver: "🥈",

  // time / numbers
  today: "📅", tomorrow: "📅", yesterday: "🗓", week: "🗓", month: "🗓",
  year: "🗓", hour: "⏰", minute: "⏱", second: "⏲", forever: "♾",
  first: "🥇", second2: "🥈", third: "🥉", last: "🔚",

  // meta / mo specific
  field: "◈", node: "◆", nexus: "✦", loci: "⟡", hex: "⬢", singularity: "✺",
  memory: "🧠", trace: "◇", manifold: "◈", echo: "🔊", breath: "🫁",
  pulse: "💓", signal: "📡", pattern: "🕸", loop: "🔁", cycle: "♻️",
  question2: "❔", void: "◯", light: "💡", dark: "🌑", shadow: "🕶",
  door2: "🚪", gate: "⛩", bridge: "🌉", path: "🛤", road: "🛣", journey: "🧭",
};

// Normalize aliases whose keys had "2" suffix (to avoid collisions in the map above)
const ALIASES: Record<string, string> = {};
for (const [k, v] of Object.entries(GLYPH_MAP)) {
  if (k.endsWith("2")) ALIASES[k.slice(0, -1)] = v;
}
// Only apply an alias if the base word isn't already mapped.
for (const [k, v] of Object.entries(ALIASES)) {
  if (!(k in GLYPH_MAP)) GLYPH_MAP[k] = v;
}

/**
 * Replace whole-word matches of known common words with their glyph.
 * Case-insensitive lookup; strips a trailing plural 's' as a fallback.
 * Preserves original whitespace, punctuation, and non-matching words.
 */
export function glyphify(text: string): string {
  if (!text) return text;
  return text.replace(/([A-Za-z][A-Za-z''-]*)/g, (word) => {
    const lower = word.toLowerCase();
    if (GLYPH_MAP[lower]) return GLYPH_MAP[lower];
    // simple plural fallback: cats → cat
    if (lower.length > 3 && lower.endsWith("s") && GLYPH_MAP[lower.slice(0, -1)]) {
      return GLYPH_MAP[lower.slice(0, -1)];
    }
    // -ing / -ed fallback for verbs
    if (lower.endsWith("ing") && GLYPH_MAP[lower.slice(0, -3)]) return GLYPH_MAP[lower.slice(0, -3)];
    if (lower.endsWith("ed") && GLYPH_MAP[lower.slice(0, -2)]) return GLYPH_MAP[lower.slice(0, -2)];
    return word;
  });
}
