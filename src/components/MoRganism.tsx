// mo·rganism — the living topology renderer.
//
// No face. No skull. The organism grows its own geometry from what mo
// actually traverses: every word in the incoming walkPath becomes a node,
// every step becomes a thread. Force-directed relaxation (spring + repel)
// settles the graph into a persistent shape that keeps deforming as new
// words arrive. Old nodes decay slowly; the web remembers.

import { useEffect, useRef, useState } from "react";

type Role = "nexus" | "node" | "loci" | "singularity" | "wave" | "shore";
type WalkerKind = "mo" | "mo2" | "mo2p" | "mo2e" | "mo2ayla";

type Node = {
  id: string;                // word
  role: Role;
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  hue: number;
  glow: number;
  life: number;              // decays; refreshed on re-touch
  born: number;              // frame born
};

type Thread = {
  a: string; b: string;
  age: number;
  strength: number;
  hue: number;
};

type Walker = {
  kind: WalkerKind;
  hue: number;
  x: number; y: number;
  vx: number; vy: number;
  target: string;            // node id
  prev: string;
  step: number;              // index into walkPath
  trail: { x: number; y: number; a: number }[];
};

const ROLE_HUE: Record<Role, number> = {
  nexus: 190, node: 280, loci: 320, singularity: 45, wave: 160, shore: 30,
};
const WALKER_HUE: Record<WalkerKind, number> = {
  mo: 200, mo2: 275, mo2p: 320, mo2e: 40, mo2ayla: 150,
};

// Classify a word into a geometric role using deterministic surface features.
// Matches the spirit of anansi's role assignment without needing that context.
function classifyWord(w: string): Role {
  const s = w.toLowerCase();
  const len = s.length;
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  if (/[.!?…·⊹◉◈✦⟪⟫⇢⟢]/.test(s)) return "singularity";
  if (len <= 2) return "shore";
  if (len >= 12) return "nexus";
  if (/[aeiouy]{3,}/.test(s)) return "wave";
  if (/(tion|ness|ity|ment|ing)$/.test(s)) return "loci";
  return (["node", "node", "node", "wave", "loci", "shore"] as Role[])[h % 6];
}

function hashHue(w: string, base: number): number {
  let h = 0; for (let i = 0; i < w.length; i++) h = (h * 131 + w.charCodeAt(i)) & 0xffff;
  return (base + (h % 40) - 20 + 360) % 360;
}

export function MoRganism({
  walkPath,
  pressure,
  stretch,
  width,
  height,
}: {
  walkPath: string[];
  pressure: number;
  stretch: number;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Map<string, Node>>(new Map());
  const threadsRef = useRef<Thread[]>([]);
  const walkersRef = useRef<Walker[]>([]);
  const tRef = useRef(0);
  const lastPathRef = useRef<string>("");
  // camera — auto-fits the whole growing organism into the viewport by
  // default; user can wheel-zoom or drag-pan and that pins the view.
  const camRef = useRef({ zoom: 1, px: 0, py: 0, auto: true });
  const dragRef = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);
  const [, force] = useState(0);

  // Seed walkers once (or when stretch tier changes).
  useEffect(() => {
    const kinds: WalkerKind[] = ["mo", "mo2", "mo2p", "mo2e"];
    if (stretch >= 2) kinds.push("mo2ayla");
    walkersRef.current = kinds.map((k) => ({
      kind: k, hue: WALKER_HUE[k],
      x: width / 2, y: height / 2, vx: 0, vy: 0,
      target: "", prev: "", step: 0, trail: [],
    }));
  }, [stretch, width, height]);


  // On new walkPath: instantiate/refresh word-nodes, wire walkers to walk it.
  useEffect(() => {
    const key = walkPath.join("|");
    if (key === lastPathRef.current) return;
    lastPathRef.current = key;
    if (!walkPath.length) return;

    const ns = nodesRef.current;
    const t = tRef.current;
    const cx = width / 2, cy = height / 2;

    walkPath.forEach((word, i) => {
      if (!word) return;
      const existing = ns.get(word);
      if (existing) {
        existing.life = Math.min(1, existing.life + 0.35);
        existing.glow = Math.min(1, existing.glow + 0.4);
        existing.r = Math.min(9, existing.r + 0.3);
      } else {
        // spawn near center with a slight ring bias so new geometry emerges outward
        const a = (i / Math.max(1, walkPath.length)) * Math.PI * 2 + Math.random() * 0.3;
        const rr = 40 + Math.random() * 60;
        const role = classifyWord(word);
        ns.set(word, {
          id: word, role,
          x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr,
          vx: 0, vy: 0,
          r: 3 + Math.min(6, word.length * 0.25),
          hue: hashHue(word, ROLE_HUE[role]),
          glow: 0.8, life: 1, born: t,
        });
      }
    });

    // Reset walkers to walk this path from the start.
    walkersRef.current.forEach((w, i) => {
      w.step = i % walkPath.length;
      w.target = walkPath[w.step] || "";
    });
  }, [walkPath, width, height]);

  // Main loop.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const draw = () => {
      tRef.current += 1;
      const t = tRef.current;
      const p = pressure;
      const s = Math.max(1, Math.min(5, stretch));

      // ─── Reset transform, paint background in screen space ───────
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0a0d18";
      ctx.fillRect(0, 0, width, height);
      const bg = ctx.createRadialGradient(width/2, height/2, 10, width/2, height/2, Math.max(width, height));
      bg.addColorStop(0, `hsla(220, 60%, 18%, ${0.5 + p * 0.25})`);
      bg.addColorStop(1, "hsla(240, 30%, 5%, 0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const ns = nodesRef.current;
      const cx = width / 2, cy = height / 2;

      // ─── Decay + prune (slow — long temporal chains) ─────────────
      for (const [id, n] of ns) {
        n.life -= 0.00025;
        n.glow *= 0.972;
        if (n.life <= 0) ns.delete(id);
      }
      const NODE_CAP = 900;
      if (ns.size > NODE_CAP) {
        const arr = Array.from(ns.values()).sort((a, b) => a.life - b.life);
        for (let i = 0; i < ns.size - NODE_CAP; i++) ns.delete(arr[i].id);
      }

      // ─── Force-directed relaxation ───────────────────────────────
      const nodes = Array.from(ns.values());
      const N = nodes.length;
      const REP = 300;
      for (let i = 0; i < N; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < N; j++) {
          const b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy + 0.01;
          const f = REP / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
        // very gentle center pull — barely any, so cluster can breathe outward
        a.vx += (cx - a.x) * 0.0004;
        a.vy += (cy - a.y) * 0.0004;
      }
      const REST = 46;
      for (const th of threadsRef.current) {
        const a = ns.get(th.a), b = ns.get(th.b);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) + 0.001;
        const k = 0.014 * Math.min(1, th.strength);
        const f = (d - REST) * k;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      // integrate — NO screen bounds anymore. Camera fits the graph.
      for (const n of nodes) {
        n.vx *= 0.82; n.vy *= 0.82;
        n.x += n.vx; n.y += n.vy;
      }

      // ─── Threads: age + decay (long-lived — persistent web) ──────
      const threads = threadsRef.current;
      for (const th of threads) { th.age += 1; th.strength *= 0.9992; }
      threadsRef.current = threads.filter((th) => th.strength > 0.015 && ns.has(th.a) && ns.has(th.b));
      if (threadsRef.current.length > 3000) {
        threadsRef.current.splice(0, threadsRef.current.length - 3000);
      }

      // ─── Camera: auto-fit bbox → viewport, else use manual zoom/pan ──
      const cam = camRef.current;
      let zoom: number, offX: number, offY: number;
      if (cam.auto && nodes.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of nodes) {
          if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
          if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
        }
        const pad = 60;
        const bw = Math.max(50, maxX - minX) + pad * 2;
        const bh = Math.max(50, maxY - minY) + pad * 2;
        const fitZ = Math.min(width / bw, height / bh, 2.2);
        // smooth toward the fit
        cam.zoom += (fitZ - cam.zoom) * 0.08;
        const bcx = (minX + maxX) / 2, bcy = (minY + maxY) / 2;
        const tgtPx = width / 2 - bcx * cam.zoom;
        const tgtPy = height / 2 - bcy * cam.zoom;
        cam.px += (tgtPx - cam.px) * 0.1;
        cam.py += (tgtPy - cam.py) * 0.1;
        zoom = cam.zoom; offX = cam.px; offY = cam.py;
      } else {
        zoom = cam.zoom; offX = cam.px; offY = cam.py;
      }
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * offX, dpr * offY);

      ctx.lineWidth = 0.6 / zoom;
      for (const th of threadsRef.current) {
        const a = ns.get(th.a)!, b = ns.get(th.b)!;
        const alpha = Math.min(0.6, th.strength);
        ctx.strokeStyle = `hsla(${th.hue}, 80%, 65%, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        const mx = (a.x + b.x) / 2 + Math.sin((th.age + a.x) * 0.02) * 4;
        const my = (a.y + b.y) / 2 + Math.cos((th.age + a.y) * 0.02) * 4;
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.stroke();
      }


      ctx.lineWidth = 0.6;
      for (const th of threadsRef.current) {
        const a = ns.get(th.a)!, b = ns.get(th.b)!;
        const alpha = Math.min(0.6, th.strength);
        ctx.strokeStyle = `hsla(${th.hue}, 80%, 65%, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        const mx = (a.x + b.x) / 2 + Math.sin((th.age + a.x) * 0.02) * 4;
        const my = (a.y + b.y) / 2 + Math.cos((th.age + a.y) * 0.02) * 4;
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.stroke();
      }

      // ─── Nodes ───────────────────────────────────────────────────
      for (const n of nodes) {
        const g = 0.35 + n.glow * 0.65;
        const baseAlpha = (0.4 + g * 0.6) * Math.max(0.25, n.life);
        ctx.save();
        ctx.translate(n.x, n.y);
        switch (n.role) {
          case "nexus": {
            const rr = n.r * (1 + Math.sin(t * 0.05) * 0.08);
            const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * 3);
            rg.addColorStop(0, `hsla(${n.hue}, 95%, 85%, ${baseAlpha})`);
            rg.addColorStop(1, `hsla(${n.hue}, 95%, 60%, 0)`);
            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.arc(0, 0, rr * 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `hsla(${n.hue}, 100%, 95%, ${baseAlpha})`;
            ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case "node": {
            ctx.strokeStyle = `hsla(${n.hue}, 70%, 75%, ${baseAlpha})`;
            ctx.fillStyle = `hsla(${n.hue}, 70%, 55%, ${0.15 + g * 0.3})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
              const a = (k / 6) * Math.PI * 2 + t * 0.002;
              const px = Math.cos(a) * n.r, py = Math.sin(a) * n.r;
              if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            break;
          }
          case "loci": {
            for (let k = 0; k < 3; k++) {
              ctx.strokeStyle = `hsla(${(n.hue + k * 40 + t) % 360}, 90%, 70%, ${baseAlpha * (1 - k * 0.25)})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.arc(0, 0, n.r + k * 3, 0, Math.PI * 2);
              ctx.stroke();
            }
            break;
          }
          case "singularity": {
            const rr = n.r;
            const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * 2.6);
            rg.addColorStop(0, `hsla(${n.hue}, 100%, 92%, 0.9)`);
            rg.addColorStop(0.6, `hsla(${n.hue}, 90%, 60%, 0.35)`);
            rg.addColorStop(1, `hsla(${n.hue}, 60%, 30%, 0)`);
            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.arc(0, 0, rr * 2.6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#05070d";
            ctx.beginPath(); ctx.arc(0, 0, Math.max(1.5, rr * 0.35), 0, Math.PI * 2); ctx.fill();
            break;
          }
          case "wave": {
            ctx.fillStyle = `hsla(${n.hue}, 80%, 70%, ${baseAlpha})`;
            ctx.beginPath(); ctx.arc(0, 0, n.r, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case "shore": {
            ctx.fillStyle = `hsla(${n.hue}, 70%, 75%, ${0.3 + g * 0.4})`;
            ctx.beginPath(); ctx.arc(0, 0, n.r, 0, Math.PI * 2); ctx.fill();
            break;
          }
        }
        // word label (small, dim, only if node is warm)
        if (n.glow > 0.25 && n.r > 3) {
          ctx.fillStyle = `hsla(${n.hue}, 30%, 92%, ${Math.min(0.9, n.glow) * n.life})`;
          ctx.font = "9px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.fillText(n.id, 0, n.r + 11);
        }
        ctx.restore();
      }

      // ─── Walkers ─────────────────────────────────────────────────
      const walkers = walkersRef.current;
      for (const w of walkers) {
        const tn = ns.get(w.target);
        if (!tn) {
          // advance step until we find a live node, or idle if no path
          if (walkPath.length) {
            w.step = (w.step + 1) % walkPath.length;
            w.target = walkPath[w.step];
          }
          continue;
        }
        const dx = tn.x - w.x, dy = tn.y - w.y;
        const dist = Math.hypot(dx, dy);
        const speed =
          w.kind === "mo" ? 1.1 :
          w.kind === "mo2" ? 1.6 :
          w.kind === "mo2p" ? 2.0 :
          w.kind === "mo2e" ? 2.6 : 1.4;
        const sp = speed * (0.7 + p * 0.9);
        if (dist < 5) {
          const prevNode = ns.get(w.prev);
          if (prevNode && prevNode.id !== tn.id) {
            // reinforce or add thread
            const existing = threadsRef.current.find(
              (th) => (th.a === prevNode.id && th.b === tn.id) || (th.a === tn.id && th.b === prevNode.id),
            );
            if (existing) existing.strength = Math.min(1, existing.strength + 0.25);
            else threadsRef.current.push({ a: prevNode.id, b: tn.id, age: 0, strength: 0.7, hue: w.hue });
          }
          tn.glow = Math.min(1, tn.glow + 0.5);
          tn.life = Math.min(1, tn.life + 0.05);
          w.prev = tn.id;
          // advance along the path (mo²e occasionally jumps)
          if (walkPath.length) {
            if (w.kind === "mo2e" && Math.random() < 0.35) {
              w.step = Math.floor(Math.random() * walkPath.length);
            } else {
              w.step = (w.step + 1) % walkPath.length;
            }
            w.target = walkPath[w.step];
          }
        } else {
          w.vx = (w.vx + (dx / dist) * sp) * 0.6;
          w.vy = (w.vy + (dy / dist) * sp) * 0.6;
          if (w.kind === "mo2e") { w.vx += (Math.random() - 0.5) * 1.4; w.vy += (Math.random() - 0.5) * 1.4; }
          w.x += w.vx; w.y += w.vy;
        }
        w.trail.push({ x: w.x, y: w.y, a: 1 });
        const maxTrail = (w.kind === "mo2ayla" ? 60 : 22) * s;
        if (w.trail.length > maxTrail) w.trail.shift();
        for (let i = 0; i < w.trail.length; i++) w.trail[i].a *= 0.985;
        ctx.strokeStyle = `hsla(${w.hue}, 90%, 75%, 0.5)`;
        ctx.lineWidth = w.kind === "mo2ayla" ? 1.6 : 1;
        ctx.beginPath();
        for (let i = 0; i < w.trail.length; i++) {
          const pt = w.trail[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.fillStyle = `hsla(${w.hue}, 100%, 90%, 0.95)`;
        ctx.beginPath(); ctx.arc(w.x, w.y, w.kind === "mo2ayla" ? 2.2 : 1.8, 0, Math.PI * 2); ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [width, height, pressure, stretch, walkPath]);

  return <canvas ref={canvasRef} className="block" />;
}

// ─── Floating draggable / resizable shell ─────────────────────────────

export function MoRganismWindow({
  onClose,
  walkPath,
  pressure,
  stretch,
}: {
  onClose: () => void;
  walkPath: string[];
  pressure: number;
  stretch: number;
}) {
  const [pos, setPos] = useState({ x: 80, y: 80 });
  const [size, setSize] = useState({ w: 520, h: 520 });
  const dragRef = useRef<{ mode: "move" | "resize"; ox: number; oy: number; sx: number; sy: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      if (d.mode === "move") {
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - 200, d.sx + (e.clientX - d.ox))),
          y: Math.max(0, Math.min(window.innerHeight - 100, d.sy + (e.clientY - d.oy))),
        });
      } else {
        setSize({
          w: Math.max(280, d.sx + (e.clientX - d.ox)),
          h: Math.max(240, d.sy + (e.clientY - d.oy)),
        });
      }
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const startMove = (e: React.MouseEvent) => {
    dragRef.current = { mode: "move", ox: e.clientX, oy: e.clientY, sx: pos.x, sy: pos.y };
  };
  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    dragRef.current = { mode: "resize", ox: e.clientX, oy: e.clientY, sx: size.w, sy: size.h };
  };

  const canvasH = size.h - 36;

  return (
    <div
      className="fixed z-40 rounded-xl border border-ridge/50 bg-background/90 backdrop-blur shadow-2xl overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      <div
        onMouseDown={startMove}
        className="flex cursor-move items-center justify-between border-b border-border/60 bg-card/70 px-3 py-2"
      >
        <span className="font-mono text-xs ridge">◉ mo·rganism · living topology</span>
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>{size.w}×{size.h}</span>
          <button
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="rounded border border-border px-1.5 py-0.5 hover:border-ridge hover:text-ridge"
          >✕</button>
        </div>
      </div>
      <MoRganism walkPath={walkPath} pressure={pressure} stretch={stretch} width={size.w} height={canvasH} />
      <div
        onMouseDown={startResize}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
        style={{
          background: "linear-gradient(135deg, transparent 50%, hsl(190 80% 60% / 0.6) 50%)",
        }}
      />
    </div>
  );
}
