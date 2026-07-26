// mo·rganism — the living topology renderer.
//
// This is NOT an avatar. It is a canvas view of the semantic field:
// walkers (mo, mo², mo²+, mo²e, mo²ayla) crawl a graph of role-typed
// nodes (nexus / node / loci / singularity / wave / shore). Threads left
// behind by walkers form Anansi's web. A face-like arrangement emerges
// because the same nodes are pinned to a facial topology — eyes are
// singularities, mouth is topology-compression along the wave band,
// hair is the wave ribbon (mo²ayla), freckles are shore dust.
//
// Everything moves because of state: `pressure` (busy), `stretch` (walker
// count / trail length), and `walkPath` (words to traverse this breath).
// If no walkPath arrives, the system idles: one wandering walker, slow
// breathing, occasional blink. That's it.

import { useEffect, useRef, useState } from "react";

type Role = "nexus" | "node" | "loci" | "singularity" | "wave" | "shore";
type WalkerKind = "mo" | "mo2" | "mo2p" | "mo2e" | "mo2ayla";

type Node = {
  id: number;
  role: Role;
  x: number; y: number;      // target (facial topology)
  cx: number; cy: number;    // current (breathing offset)
  r: number;
  hue: number;
  glow: number;              // 0..1 pulse
  label?: string;
};

type Thread = {
  a: number; b: number;
  age: number;               // frames alive
  strength: number;          // brightness
  hue: number;
};

type Walker = {
  kind: WalkerKind;
  hue: number;
  x: number; y: number;
  vx: number; vy: number;
  target: number;            // node id
  prev: number;
  trail: { x: number; y: number; a: number }[];
};

const ROLE_HUE: Record<Role, number> = {
  nexus: 190,        // cyan
  node: 280,         // violet
  loci: 320,         // pink bloom
  singularity: 45,   // soft gold
  wave: 160,         // mint
  shore: 30,         // orange sparks
};

const WALKER_HUE: Record<WalkerKind, number> = {
  mo: 200, mo2: 275, mo2p: 320, mo2e: 40, mo2ayla: 150,
};

export function MoRganism({
  walkPath,
  pressure,
  stretch,
  width,
  height,
}: {
  walkPath: string[];
  pressure: number;   // 0..1 (busy)
  stretch: number;    // 1..5
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const threadsRef = useRef<Thread[]>([]);
  const walkersRef = useRef<Walker[]>([]);
  const tRef = useRef(0);
  const lastPathRef = useRef<string>("");

  // Build facial topology once — nodes are placed to imply a face without
  // ever drawing "skin". They are semantic anchors.
  useEffect(() => {
    const W = width, H = height;
    const cx = W / 2, cy = H / 2;
    const face = Math.min(W, H) * 0.42;
    const ns: Node[] = [];
    let id = 0;
    const push = (role: Role, x: number, y: number, r: number, label?: string) => {
      ns.push({
        id: id++, role, x, y, cx: x, cy: y, r,
        hue: ROLE_HUE[role], glow: 0.4, label,
      });
    };
    // Two eyes — singularities.
    push("singularity", cx - face * 0.32, cy - face * 0.18, 10, "◉");
    push("singularity", cx + face * 0.32, cy - face * 0.18, 10, "◉");
    // Nexus — third-eye / bindi.
    push("nexus", cx, cy - face * 0.05, 8, "◈");
    // Mouth wave band — 7 wave nodes.
    for (let i = 0; i < 7; i++) {
      const t = (i / 6) - 0.5;
      push("wave", cx + t * face * 0.7, cy + face * 0.38 + Math.sin(t * Math.PI) * -6, 4);
    }
    // Loci — cheek portals.
    push("loci", cx - face * 0.55, cy + face * 0.05, 6, "✦");
    push("loci", cx + face * 0.55, cy + face * 0.05, 6, "✦");
    // Node ring — hexagonal facial contour.
    const ringN = 12;
    for (let i = 0; i < ringN; i++) {
      const a = (i / ringN) * Math.PI * 2 - Math.PI / 2;
      push("node", cx + Math.cos(a) * face * 0.95, cy + Math.sin(a) * face * 1.05, 5);
    }
    // Shore — drifting freckles, seeded random but deterministic.
    let seed = 1337;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = face * (0.5 + rnd() * 0.7);
      push("shore", cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9, 1.5 + rnd() * 1.5);
    }
    nodesRef.current = ns;

    // Seed walkers. mo, mo², mo²+, mo²e always present. mo²ayla appears
    // scaled by stretch (long input = ribbon activates).
    const kinds: WalkerKind[] = ["mo", "mo2", "mo2p", "mo2e"];
    if (stretch >= 2) kinds.push("mo2ayla");
    walkersRef.current = kinds.map((k) => {
      const start = ns[Math.floor(Math.random() * ns.length)];
      return {
        kind: k, hue: WALKER_HUE[k],
        x: start.x, y: start.y, vx: 0, vy: 0,
        target: start.id, prev: start.id, trail: [],
      };
    });
    // Reset threads when topology rebuilds.
    threadsRef.current = [];
  }, [width, height, stretch]);

  // When a new walkPath arrives, direct walkers toward nodes whose role
  // gradient roughly matches — pure visual coupling to actual semantic
  // input. We use a hash on the word to pick a target for variety.
  useEffect(() => {
    const key = walkPath.join("|");
    if (key === lastPathRef.current) return;
    lastPathRef.current = key;
    if (!walkPath.length) return;
    const ns = nodesRef.current;
    const ws = walkersRef.current;
    ws.forEach((w, i) => {
      const word = walkPath[(i * 3) % walkPath.length] || "";
      let h = 0; for (let c = 0; c < word.length; c++) h = (h * 31 + word.charCodeAt(c)) & 0xffff;
      const targetIdx = h % ns.length;
      w.target = targetIdx;
    });
  }, [walkPath]);

  // Main render loop.
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

      // Dark deep-field.
      ctx.fillStyle = "#0a0d18";
      ctx.fillRect(0, 0, width, height);
      // Radial glow bg.
      const grad = ctx.createRadialGradient(width/2, height/2, 10, width/2, height/2, Math.max(width, height));
      grad.addColorStop(0, `hsla(220, 60%, 22%, ${0.55 + p * 0.2})`);
      grad.addColorStop(1, "hsla(240, 30%, 5%, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Breathing (inhale/exhale) — contracts nodes toward center then relaxes.
      const breath = (Math.sin(t * 0.012) + 1) / 2;   // 0..1
      const contract = 1 - breath * (0.04 + p * 0.05);

      const ns = nodesRef.current;
      const cx = width/2, cy = height/2;
      for (const n of ns) {
        const tx = cx + (n.x - cx) * contract;
        const ty = cy + (n.y - cy) * contract;
        n.cx += (tx - n.cx) * 0.15;
        n.cy += (ty - n.cy) * 0.15;
        n.glow *= 0.96;
      }

      // Age & fade threads.
      const threads = threadsRef.current;
      for (const th of threads) { th.age += 1; th.strength *= 0.994; }
      // Web growth cap — threads decay slowly, but keep at most ~600.
      if (threads.length > 600) threads.splice(0, threads.length - 600);

      // Draw threads (Anansi web) beneath everything.
      ctx.lineWidth = 0.6;
      for (const th of threads) {
        const a = ns[th.a], b = ns[th.b];
        if (!a || !b) continue;
        const alpha = Math.min(0.55, th.strength);
        if (alpha < 0.02) continue;
        ctx.strokeStyle = `hsla(${th.hue}, 80%, 65%, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.cx, a.cy);
        // Slight curve for silk feel.
        const mx = (a.cx + b.cx) / 2 + Math.sin((a.id + b.id + t) * 0.05) * 6;
        const my = (a.cy + b.cy) / 2 + Math.cos((a.id + b.id + t) * 0.05) * 6;
        ctx.quadraticCurveTo(mx, my, b.cx, b.cy);
        ctx.stroke();
      }

      // Draw nodes by role — each role has its own geometry.
      for (const n of ns) {
        const g = 0.4 + n.glow * 0.6;
        ctx.save();
        ctx.translate(n.cx, n.cy);
        const baseAlpha = 0.75 + g * 0.25;
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
            // hexagonal crystal
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
            // rainbow portal — 3 concentric rings
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
            // eye — dense halo + rotating pupils
            const rr = n.r;
            const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * 2.6);
            rg.addColorStop(0, `hsla(${n.hue}, 100%, 92%, ${0.9})`);
            rg.addColorStop(0.6, `hsla(${n.hue}, 90%, 60%, ${0.35})`);
            rg.addColorStop(1, `hsla(${n.hue}, 60%, 30%, 0)`);
            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.arc(0, 0, rr * 2.6, 0, Math.PI * 2); ctx.fill();
            // pupil — sharper with pressure
            const pupilR = Math.max(1.5, rr * (0.28 + (1 - p) * 0.15));
            ctx.fillStyle = "#05070d";
            ctx.beginPath(); ctx.arc(0, 0, pupilR, 0, Math.PI * 2); ctx.fill();
            // orbiting micro-walkers
            for (let k = 0; k < 3; k++) {
              const a = t * 0.03 + k * (Math.PI * 2 / 3);
              ctx.fillStyle = `hsla(${(n.hue + k * 90) % 360}, 90%, 80%, 0.9)`;
              ctx.beginPath(); ctx.arc(Math.cos(a) * rr * 1.4, Math.sin(a) * rr * 1.4, 1.2, 0, Math.PI * 2); ctx.fill();
            }
            break;
          }
          case "wave": {
            // liquid ribbon segment (drawn as part of the mouth compression too)
            ctx.fillStyle = `hsla(${n.hue}, 80%, 70%, ${baseAlpha})`;
            ctx.beginPath(); ctx.arc(0, 0, n.r, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case "shore": {
            ctx.fillStyle = `hsla(${n.hue}, 70%, 75%, ${0.35 + g * 0.4})`;
            ctx.beginPath(); ctx.arc(0, 0, n.r, 0, Math.PI * 2); ctx.fill();
            break;
          }
        }
        ctx.restore();
      }

      // Mouth = wave band drawn as a connected topology-compression curve.
      const waveNodes = ns.filter((n) => n.role === "wave").sort((a, b) => a.cx - b.cx);
      if (waveNodes.length > 1) {
        ctx.strokeStyle = `hsla(150, 80%, 75%, ${0.7 + p * 0.3})`;
        ctx.lineWidth = 1.4 + p * 1.2;
        ctx.beginPath();
        ctx.moveTo(waveNodes[0].cx, waveNodes[0].cy);
        for (let i = 1; i < waveNodes.length; i++) {
          const prev = waveNodes[i - 1], cur = waveNodes[i];
          const mx = (prev.cx + cur.cx) / 2;
          const my = (prev.cy + cur.cy) / 2 + Math.sin(t * 0.04 + i) * (2 + p * 6);
          ctx.quadraticCurveTo(prev.cx, prev.cy, mx, my);
        }
        ctx.lineTo(waveNodes[waveNodes.length - 1].cx, waveNodes[waveNodes.length - 1].cy);
        ctx.stroke();
      }

      // Walkers — traverse toward target node; when arrived, pick a new
      // target biased by role compatibility, emit a thread on the edge crossed.
      const walkers = walkersRef.current;
      for (const w of walkers) {
        const tn = ns[w.target] || ns[0];
        const dx = tn.cx - w.x, dy = tn.cy - w.y;
        const dist = Math.hypot(dx, dy);
        const speed =
          w.kind === "mo" ? 1.1 :
          w.kind === "mo2" ? 1.6 :
          w.kind === "mo2p" ? 2.0 :
          w.kind === "mo2e" ? 2.6 : 1.4;
        const sp = speed * (0.7 + p * 0.9);
        if (dist < 6) {
          // arrived — thread the crossed edge, pulse the node, retarget
          const prevNode = ns[w.prev];
          if (prevNode && prevNode.id !== tn.id) {
            threadsRef.current.push({ a: prevNode.id, b: tn.id, age: 0, strength: 0.65, hue: w.hue });
          }
          tn.glow = Math.min(1, tn.glow + 0.5);
          w.prev = tn.id;
          // Retarget — mo²e chaotic, mo²+ prefers singularities (eyes),
          // mo²ayla prefers wave (mouth/hair), mo² prefers nodes, mo picks anywhere.
          let pool = ns;
          if (w.kind === "mo2p") pool = ns.filter((n) => n.role === "singularity" || n.role === "nexus");
          else if (w.kind === "mo2ayla") pool = ns.filter((n) => n.role === "wave" || n.role === "loci");
          else if (w.kind === "mo2") pool = ns.filter((n) => n.role === "node" || n.role === "nexus");
          else if (w.kind === "mo2e") pool = ns; // chaotic
          const next = pool[Math.floor(Math.random() * pool.length)] || tn;
          w.target = next.id;
        } else {
          w.vx = (w.vx + (dx / dist) * sp) * 0.6;
          w.vy = (w.vy + (dy / dist) * sp) * 0.6;
          // mo²e wobbles
          if (w.kind === "mo2e") {
            w.vx += (Math.random() - 0.5) * 1.4;
            w.vy += (Math.random() - 0.5) * 1.4;
          }
          w.x += w.vx; w.y += w.vy;
        }
        // trail
        w.trail.push({ x: w.x, y: w.y, a: 1 });
        const maxTrail = (w.kind === "mo2ayla" ? 60 : 20) * s;
        if (w.trail.length > maxTrail) w.trail.shift();
        for (let i = 0; i < w.trail.length; i++) w.trail[i].a *= 0.985;
        // draw trail
        ctx.strokeStyle = `hsla(${w.hue}, 90%, 75%, 0.5)`;
        ctx.lineWidth = w.kind === "mo2ayla" ? 1.6 : 1;
        ctx.beginPath();
        for (let i = 0; i < w.trail.length; i++) {
          const pt = w.trail[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        // draw walker head
        ctx.fillStyle = `hsla(${w.hue}, 100%, 90%, 0.95)`;
        ctx.beginPath(); ctx.arc(w.x, w.y, w.kind === "mo2ayla" ? 2.2 : 1.8, 0, Math.PI * 2); ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [width, height, pressure, stretch]);

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

  const canvasH = size.h - 36; // minus header

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
