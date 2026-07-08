import { useEffect, useRef } from "react";

// 7 visualization models. Tiny orbs use the language as repulsion/attraction.
export type VizMode = "field" | "lattice" | "flow" | "waves" | "mandala" | "constellation" | "vortex";

export const VIZ_MODES: { id: VizMode; label: string }[] = [
  { id: "field", label: "field" },
  { id: "lattice", label: "lattice" },
  { id: "flow", label: "flow" },
  { id: "waves", label: "waves" },
  { id: "mandala", label: "mandala" },
  { id: "constellation", label: "constellation" },
  { id: "vortex", label: "vortex" },
];

type Orb = { x: number; y: number; vx: number; vy: number; word: string; mass: number };

export function MoVisualizer({
  mode, words, colors, gravity, repulsion, pressure,
}: {
  mode: VizMode;
  words: string[];
  colors: string[];
  gravity: number;      // 0..1
  repulsion: number;    // 0..1
  pressure: number;     // 0..1
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const orbsRef = useRef<Orb[]>([]);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);

  useEffect(() => {
    const w = 60;
    const list: Orb[] = (words.length ? words : ["mo", "field", "breath", "dream", "return"]).slice(0, 40).map((word, i) => ({
      x: Math.cos((i / w) * Math.PI * 2) * 120 + 200,
      y: Math.sin((i / w) * Math.PI * 2) * 120 + 200,
      vx: 0, vy: 0, word, mass: 0.5 + (word.length / 20),
    }));
    orbsRef.current = list;
  }, [words]);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const parent = cv.parentElement!;
    const resize = () => { cv.width = parent.clientWidth; cv.height = parent.clientHeight; };
    resize(); window.addEventListener("resize", resize);

    const tick = () => {
      tRef.current += 0.016;
      const t = tRef.current;
      const W = cv.width, H = cv.height;
      const cx = W / 2, cy = H / 2;
      const orbs = orbsRef.current;

      // physics: repulsion between orbs, attraction to center (gravity)
      for (let i = 0; i < orbs.length; i++) {
        const o = orbs[i];
        // center gravity
        const dx = cx - o.x, dy = cy - o.y;
        const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        o.vx += (dx / d) * gravity * 0.15;
        o.vy += (dy / d) * gravity * 0.15;
        // orb-orb repulsion using word "length" as charge
        for (let j = i + 1; j < orbs.length; j++) {
          const p = orbs[j];
          const rx = o.x - p.x, ry = o.y - p.y;
          const r2 = rx * rx + ry * ry + 40;
          const f = (repulsion * 800 * o.mass * p.mass) / r2;
          const rl = Math.sqrt(r2);
          o.vx += (rx / rl) * f * 0.02;
          o.vy += (ry / rl) * f * 0.02;
          p.vx -= (rx / rl) * f * 0.02;
          p.vy -= (ry / rl) * f * 0.02;
        }
        o.vx *= 0.94; o.vy *= 0.94;
        o.x += o.vx; o.y += o.vy;
      }

      ctx.fillStyle = "rgba(8,10,18,0.35)";
      ctx.fillRect(0, 0, W, H);

      switch (mode) {
        case "field": drawField(ctx, cx, cy, t, orbs, colors, pressure); break;
        case "lattice": drawLattice(ctx, orbs, colors); break;
        case "flow": drawFlow(ctx, orbs, colors, t); break;
        case "waves": drawWaves(ctx, cx, cy, t, colors, pressure); drawOrbs(ctx, orbs, colors); break;
        case "mandala": drawMandala(ctx, cx, cy, t, orbs, colors); break;
        case "constellation": drawConstellation(ctx, orbs, colors); break;
        case "vortex": drawVortex(ctx, cx, cy, t, orbs, colors, pressure); break;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize); };
  }, [mode, colors, gravity, repulsion, pressure]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

function pickColor(colors: string[], i: number) { return colors[i % colors.length] || "#3CC8DC"; }

function drawOrbs(ctx: CanvasRenderingContext2D, orbs: Orb[], colors: string[]) {
  for (let i = 0; i < orbs.length; i++) {
    const o = orbs[i];
    const c = pickColor(colors, i);
    ctx.fillStyle = c + "cc";
    ctx.beginPath(); ctx.arc(o.x, o.y, 2 + o.mass * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c + "60";
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillText(o.word, o.x + 4, o.y - 4);
  }
}
function drawField(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, orbs: Orb[], colors: string[], p: number) {
  for (let r = 30; r < 300; r += 30) {
    ctx.strokeStyle = pickColor(colors, r / 30 | 0) + "22";
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2; a += 0.05) {
      const wob = Math.sin(a * 5 + t) * (5 + p * 15);
      const x = cx + Math.cos(a) * (r + wob), y = cy + Math.sin(a) * (r + wob);
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
  }
  drawOrbs(ctx, orbs, colors);
}
function drawLattice(ctx: CanvasRenderingContext2D, orbs: Orb[], colors: string[]) {
  for (let i = 0; i < orbs.length; i++) for (let j = i + 1; j < orbs.length; j++) {
    const a = orbs[i], b = orbs[j];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < 90) {
      ctx.strokeStyle = pickColor(colors, i) + Math.floor(60 * (1 - d / 90)).toString(16).padStart(2, "0");
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  drawOrbs(ctx, orbs, colors);
}
function drawFlow(ctx: CanvasRenderingContext2D, orbs: Orb[], colors: string[], t: number) {
  ctx.strokeStyle = "#3CC8DC30"; ctx.beginPath();
  for (let i = 0; i < orbs.length - 1; i++) {
    const a = orbs[i], b = orbs[i + 1];
    const mx = (a.x + b.x) / 2 + Math.sin(t + i) * 10, my = (a.y + b.y) / 2 + Math.cos(t + i) * 10;
    ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y);
  }
  ctx.stroke(); drawOrbs(ctx, orbs, colors);
}
function drawWaves(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, colors: string[], p: number) {
  for (let i = 0; i < 6; i++) {
    const r = ((t * 40 + i * 60) % 360);
    ctx.strokeStyle = pickColor(colors, i) + Math.floor((1 - r / 360) * 180).toString(16).padStart(2, "0");
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    void p;
  }
}
function drawMandala(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, orbs: Orb[], colors: string[]) {
  const petals = 12;
  for (let p = 0; p < petals; p++) {
    const a = (p / petals) * Math.PI * 2 + t * 0.1;
    ctx.strokeStyle = pickColor(colors, p) + "60";
    ctx.beginPath();
    for (let r = 10; r < 150; r += 3) {
      const x = cx + Math.cos(a) * r + Math.sin(r * 0.1 + t) * 15;
      const y = cy + Math.sin(a) * r + Math.cos(r * 0.1 + t) * 15;
      if (r === 10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  drawOrbs(ctx, orbs, colors);
}
function drawConstellation(ctx: CanvasRenderingContext2D, orbs: Orb[], colors: string[]) {
  const sorted = [...orbs].sort((a, b) => b.mass - a.mass).slice(0, Math.min(10, orbs.length));
  for (let i = 0; i < sorted.length - 1; i++) {
    ctx.strokeStyle = pickColor(colors, i) + "70";
    ctx.beginPath(); ctx.moveTo(sorted[i].x, sorted[i].y); ctx.lineTo(sorted[i + 1].x, sorted[i + 1].y); ctx.stroke();
  }
  drawOrbs(ctx, orbs, colors);
}
function drawVortex(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, orbs: Orb[], colors: string[], p: number) {
  for (let i = 0; i < 100; i++) {
    const a = i * 0.3 + t;
    const r = i * 3;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    ctx.fillStyle = pickColor(colors, i / 5 | 0) + "40";
    ctx.beginPath(); ctx.arc(x, y, 1 + p * 2, 0, Math.PI * 2); ctx.fill();
  }
  drawOrbs(ctx, orbs, colors);
}
