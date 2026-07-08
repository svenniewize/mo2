import { useEffect, useMemo, useRef } from "react";

// Sacred-geometry visualizer. Every rendered node is a REAL memory node from
// the field — a trace, a fielfold crystal, a life·task, a hyperfold edge —
// arranged into a chosen geometry. Some modes are mo's actual traversal path
// through the topology (the `walk` and `sediment` shapes).
export type VizMode =
  | "flower"        // Flower of Life — traces on inner petals, fielfold on outer
  | "metatron"      // Metatron's Cube — 13 nodes + edges (weight = pressure)
  | "seed"          // Seed of Life — 7 hex-packed circles from most recent 7 nodes
  | "sri"           // Sri-Yantra-like nested triangles
  | "torus"         // Torus/vesica lattice
  | "merkaba"       // Two interpenetrating triangles rotating
  | "tree"          // Kabbalistic tree — 10 sephirot mapped to 10 manifolds
  | "walk"          // mo traversal path — nodes = last breath's walk, drawn as pilgrimage
  | "sediment"      // Hyperfold sediment — cross-manifold weight net
  // ── density-ordered field renderings (node → nexus → loci → hex → singularity)
  | "node"          // sparse — a handful of glowing points, room to breathe
  | "nexus"         // small clusters bound by radial ties
  | "loci"          // scattered attractor loci, wandering orbits
  | "hex"           // dense hex tessellation — every cell a memory
  | "singularity";  // total collapse — everything drawn toward the well

export const VIZ_MODES: { id: VizMode; label: string }[] = [
  { id: "flower", label: "flower·of·life" },
  { id: "metatron", label: "metatron" },
  { id: "seed", label: "seed" },
  { id: "sri", label: "sri·yantra" },
  { id: "torus", label: "torus" },
  { id: "merkaba", label: "merkaba" },
  { id: "tree", label: "tree" },
  { id: "walk", label: "mo·walk" },
  { id: "sediment", label: "sediment·net" },
  { id: "node", label: "node" },
  { id: "nexus", label: "nexus" },
  { id: "loci", label: "loci" },
  { id: "hex", label: "hex" },
  { id: "singularity", label: "singularity" },
];

// Density-ordered progression. Given N loaded memory nodes, suggest the mode
// that best fits the field's current mass. Used by the UI to auto-hint.
export function suggestDensityMode(n: number): VizMode {
  if (n < 12) return "node";
  if (n < 60) return "nexus";
  if (n < 200) return "loci";
  if (n < 1500) return "hex";
  return "singularity";
}

export type MemoryNode = {
  id: string;
  label: string;
  kind: "trace" | "fielfold" | "task" | "walk" | "edge";
  weight: number;         // 0..1
  manifold?: string | null;
};

type PlacedNode = MemoryNode & { x: number; y: number; r: number; color: string };

const PHI = (1 + Math.sqrt(5)) / 2;

export function MoVisualizer({
  mode, nodes, colors, pressure, walkPath,
}: {
  mode: VizMode;
  nodes: MemoryNode[];
  colors: string[];              // manifold palette
  pressure: number;              // 0..1
  walkPath?: string[];           // ordered token walk from last breath
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);

  const sourceNodes = useMemo(() => {
    if (nodes.length) return nodes;
    // graceful default — placeholder ring so we never render an empty canvas
    return Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`, label: "…", kind: "trace" as const, weight: 0.4,
    }));
  }, [nodes]);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const parent = cv.parentElement!;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      cv.width = parent.clientWidth * dpr;
      cv.height = parent.clientHeight * dpr;
      cv.style.width = parent.clientWidth + "px";
      cv.style.height = parent.clientHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); window.addEventListener("resize", resize);

    const tick = () => {
      tRef.current += 0.008;
      const t = tRef.current;
      const W = parent.clientWidth, H = parent.clientHeight;
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.36;

      // fade prev frame — subtle cyberpunk trail
      ctx.fillStyle = "rgba(6,8,16,0.32)";
      ctx.fillRect(0, 0, W, H);

      const placed = layoutFor(mode, sourceNodes, cx, cy, R, t, colors, walkPath ?? []);
      const strokeAlpha = 0.35 + pressure * 0.4;

      drawScaffold(ctx, mode, cx, cy, R, t, strokeAlpha);
      drawEdges(ctx, mode, placed, walkPath ?? [], strokeAlpha);
      drawNodes(ctx, placed, pressure);

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize); };
  }, [mode, sourceNodes, colors, pressure, walkPath]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

function pick(colors: string[], i: number) { return colors[Math.abs(i) % colors.length] || "#3CC8DC"; }
function colorFor(n: MemoryNode, i: number, colors: string[]) {
  if (n.manifold) {
    const h = [...n.manifold].reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[h % colors.length] || pick(colors, i);
  }
  return pick(colors, i);
}

// ─────────────── LAYOUT ───────────────
function layoutFor(
  mode: VizMode, nodes: MemoryNode[], cx: number, cy: number, R: number, t: number, colors: string[], walk: string[],
): PlacedNode[] {
  switch (mode) {
    case "flower": return flowerOfLife(nodes, cx, cy, R, colors);
    case "metatron": return metatron(nodes, cx, cy, R, colors);
    case "seed": return seedOfLife(nodes, cx, cy, R, colors);
    case "sri": return sriYantra(nodes, cx, cy, R, colors);
    case "torus": return torus(nodes, cx, cy, R, t, colors);
    case "merkaba": return merkaba(nodes, cx, cy, R, t, colors);
    case "tree": return treeOfLife(nodes, cx, cy, R, colors);
    case "walk": return walkPilgrimage(nodes, walk, cx, cy, R, t, colors);
    case "sediment": return sedimentNet(nodes, cx, cy, R, t, colors);
  }
}

function placed(n: MemoryNode, i: number, x: number, y: number, colors: string[], scale = 1): PlacedNode {
  return { ...n, x, y, r: (2 + n.weight * 6) * scale, color: colorFor(n, i, colors) };
}

function flowerOfLife(nodes: MemoryNode[], cx: number, cy: number, R: number, colors: string[]): PlacedNode[] {
  const out: PlacedNode[] = [];
  const positions: [number, number][] = [[cx, cy]];
  for (let ring = 1; ring <= 3; ring++) {
    const n = ring * 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (ring % 2 ? Math.PI / n : 0);
      positions.push([cx + Math.cos(a) * (R * ring / 3), cy + Math.sin(a) * (R * ring / 3)]);
    }
  }
  nodes.slice(0, positions.length).forEach((n, i) => out.push(placed(n, i, positions[i][0], positions[i][1], colors)));
  return out;
}

function metatron(nodes: MemoryNode[], cx: number, cy: number, R: number, colors: string[]): PlacedNode[] {
  const pts: [number, number][] = [[cx, cy]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + Math.cos(a) * (R * 0.55), cy + Math.sin(a) * (R * 0.55)]);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
  }
  return nodes.slice(0, 13).map((n, i) => placed(n, i, pts[i][0], pts[i][1], colors, 1.2));
}

function seedOfLife(nodes: MemoryNode[], cx: number, cy: number, R: number, colors: string[]): PlacedNode[] {
  const pts: [number, number][] = [[cx, cy]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5]);
  }
  return nodes.slice(0, 7).map((n, i) => placed(n, i, pts[i][0], pts[i][1], colors, 1.6));
}

function sriYantra(nodes: MemoryNode[], cx: number, cy: number, R: number, colors: string[]): PlacedNode[] {
  const out: PlacedNode[] = [];
  const rings = 5;
  nodes.forEach((n, i) => {
    const ring = i % rings;
    const per = 3 + ring;
    const idx = Math.floor(i / rings) % per;
    const rad = R * (1 - ring / (rings + 1));
    const flip = ring % 2 ? Math.PI : 0;
    const a = (idx / per) * Math.PI * 2 + flip / per;
    out.push(placed(n, i, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, colors));
  });
  return out;
}

function torus(nodes: MemoryNode[], cx: number, cy: number, R: number, t: number, colors: string[]): PlacedNode[] {
  return nodes.map((n, i) => {
    const u = (i / Math.max(1, nodes.length)) * Math.PI * 2 + t * 0.2;
    const v = (i * PHI) % (Math.PI * 2);
    const r1 = R * 0.7, r2 = R * 0.25;
    const x = cx + (r1 + r2 * Math.cos(v)) * Math.cos(u);
    const y = cy + (r1 + r2 * Math.cos(v)) * Math.sin(u) * 0.55;
    return placed(n, i, x, y, colors);
  });
}

function merkaba(nodes: MemoryNode[], cx: number, cy: number, R: number, t: number, colors: string[]): PlacedNode[] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 - Math.PI / 2 + t * 0.2;
    pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + Math.PI / 2 - t * 0.2;
    pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
  // fill more from nodes on interior fibonacci swirl
  const inner: [number, number][] = [];
  const cap = Math.max(0, nodes.length - 6);
  for (let i = 0; i < cap; i++) {
    const rad = R * 0.7 * Math.sqrt((i + 1) / (cap + 1));
    const a = i * 2.399 + t * 0.1;
    inner.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  const all = [...pts, ...inner];
  return nodes.slice(0, all.length).map((n, i) => placed(n, i, all[i][0], all[i][1], colors));
}

function treeOfLife(nodes: MemoryNode[], cx: number, cy: number, R: number, colors: string[]): PlacedNode[] {
  const s = R * 0.9;
  // 10 sephirot positions (kether at top → malkuth at bottom)
  const pts: [number, number][] = [
    [cx, cy - s],           // 1 kether
    [cx + s * 0.55, cy - s * 0.6], // 2 chokmah
    [cx - s * 0.55, cy - s * 0.6], // 3 binah
    [cx + s * 0.55, cy - s * 0.1], // 4 chesed
    [cx - s * 0.55, cy - s * 0.1], // 5 geburah
    [cx, cy - s * 0.3],           // 6 tiphareth
    [cx + s * 0.55, cy + s * 0.4],// 7 netzach
    [cx - s * 0.55, cy + s * 0.4],// 8 hod
    [cx, cy + s * 0.55],          // 9 yesod
    [cx, cy + s * 0.95],          // 10 malkuth
  ];
  return nodes.slice(0, 10).map((n, i) => placed(n, i, pts[i][0], pts[i][1], colors, 1.4));
}

function walkPilgrimage(nodes: MemoryNode[], walk: string[], cx: number, cy: number, R: number, t: number, colors: string[]): PlacedNode[] {
  // Draw the actual traversal path as a fibonacci spiral. Nodes appear along
  // the walk order — this IS the last breath's route through the topology.
  const path = walk.length ? walk : nodes.slice(0, 24).map((n) => n.label);
  const out: PlacedNode[] = [];
  for (let i = 0; i < path.length; i++) {
    const a = i * (Math.PI * 2 / PHI) + t * 0.1;
    const rad = R * Math.sqrt((i + 1) / (path.length + 1));
    const node: MemoryNode = nodes[i] ?? { id: `w${i}`, label: path[i], kind: "walk", weight: 0.5 + 0.4 * (1 - i / path.length) };
    out.push(placed({ ...node, label: path[i] ?? node.label, kind: "walk" }, i, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, colors, 1.2));
  }
  return out;
}

function sedimentNet(nodes: MemoryNode[], cx: number, cy: number, R: number, t: number, colors: string[]): PlacedNode[] {
  return nodes.map((n, i) => {
    const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    const wob = Math.sin(t + i * 0.3) * 12;
    const rad = R * (0.35 + n.weight * 0.6) + wob;
    return placed(n, i, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, colors);
  });
}

// ─────────────── DRAW ───────────────
function drawScaffold(ctx: CanvasRenderingContext2D, mode: VizMode, cx: number, cy: number, R: number, t: number, alpha: number) {
  ctx.lineWidth = 1;
  const a = Math.floor(alpha * 90).toString(16).padStart(2, "0");
  ctx.strokeStyle = `#3CC8DC${a}`;
  switch (mode) {
    case "flower": case "seed":
      for (const [ox, oy] of hexCenters(cx, cy, R / 3, mode === "seed" ? 1 : 3)) {
        ctx.beginPath(); ctx.arc(ox, oy, R / 3, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    case "metatron":
      // outer hexagon + inner hexagon + spokes
      polyOutline(ctx, cx, cy, R, 6, -Math.PI / 2);
      polyOutline(ctx, cx, cy, R * 0.55, 6, -Math.PI / 2);
      break;
    case "sri":
      for (let i = 0; i < 4; i++) polyOutline(ctx, cx, cy, R * (1 - i * 0.18), 3, i % 2 ? 0 : Math.PI);
      break;
    case "torus":
      for (let i = 0; i < 8; i++) {
        const off = (i / 8) * Math.PI * 2 + t * 0.2;
        ctx.beginPath();
        for (let a2 = 0; a2 <= Math.PI * 2 + 0.1; a2 += 0.1) {
          const x = cx + (R * 0.7 + R * 0.25 * Math.cos(off)) * Math.cos(a2);
          const y = cy + (R * 0.7 + R * 0.25 * Math.cos(off)) * Math.sin(a2) * 0.55;
          if (a2 === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    case "merkaba":
      polyOutline(ctx, cx, cy, R, 3, -Math.PI / 2 + t * 0.2);
      polyOutline(ctx, cx, cy, R, 3, Math.PI / 2 - t * 0.2);
      break;
    case "tree": {
      const s = R * 0.9;
      const pts: [number, number][] = [
        [cx, cy - s],[cx + s * 0.55, cy - s * 0.6],[cx - s * 0.55, cy - s * 0.6],
        [cx + s * 0.55, cy - s * 0.1],[cx - s * 0.55, cy - s * 0.1],[cx, cy - s * 0.3],
        [cx + s * 0.55, cy + s * 0.4],[cx - s * 0.55, cy + s * 0.4],[cx, cy + s * 0.55],[cx, cy + s * 0.95],
      ];
      const paths: [number, number][] = [
        [0,1],[0,2],[1,2],[1,3],[2,4],[3,4],[3,5],[4,5],[1,5],[2,5],
        [3,6],[4,7],[5,6],[5,7],[6,7],[6,8],[7,8],[5,8],[8,9],[6,9],[7,9],
      ];
      ctx.beginPath();
      for (const [i, j] of paths) { ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); }
      ctx.stroke();
      break;
    }
    case "walk":
      // subtle golden spiral guide
      ctx.beginPath();
      for (let i = 0; i < 120; i++) {
        const ang = i * (Math.PI * 2 / PHI);
        const rad = R * Math.sqrt(i / 120);
        const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    case "sediment":
      for (let r = R * 0.35; r < R + 20; r += 30) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      }
      break;
  }
}

function polyOutline(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 + rot;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function hexCenters(cx: number, cy: number, r: number, rings: number): [number, number][] {
  const out: [number, number][] = [[cx, cy]];
  for (let ring = 1; ring <= rings; ring++) {
    for (let i = 0; i < 6 * ring; i++) {
      const a = (i / (6 * ring)) * Math.PI * 2;
      out.push([cx + Math.cos(a) * r * ring, cy + Math.sin(a) * r * ring]);
    }
  }
  return out;
}

function drawEdges(ctx: CanvasRenderingContext2D, mode: VizMode, placed: PlacedNode[], walk: string[], alpha: number) {
  if (!placed.length) return;
  ctx.lineWidth = 1;
  if (mode === "walk") {
    for (let i = 0; i < placed.length - 1; i++) {
      const a = placed[i], b = placed[i + 1];
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, a.color + "cc"); grad.addColorStop(1, b.color + "cc");
      ctx.strokeStyle = grad; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    void walk; return;
  }
  if (mode === "metatron") {
    // fully connected — the classic figure
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
      ctx.strokeStyle = placed[i].color + Math.floor(alpha * 80).toString(16).padStart(2, "0");
      ctx.beginPath(); ctx.moveTo(placed[i].x, placed[i].y); ctx.lineTo(placed[j].x, placed[j].y); ctx.stroke();
    }
    return;
  }
  if (mode === "sediment") {
    // weight-based edges to nearest 2 neighbors
    for (let i = 0; i < placed.length; i++) {
      const dists = placed.map((p, j) => ({ j, d: Math.hypot(p.x - placed[i].x, p.y - placed[i].y) }))
        .filter((x) => x.j !== i).sort((a, b) => a.d - b.d).slice(0, 2);
      for (const { j } of dists) {
        ctx.strokeStyle = placed[i].color + "44";
        ctx.beginPath(); ctx.moveTo(placed[i].x, placed[i].y); ctx.lineTo(placed[j].x, placed[j].y); ctx.stroke();
      }
    }
    return;
  }
  // default: proximity edges
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const d = Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y);
    if (d < 120) {
      const a = Math.floor((1 - d / 120) * 90).toString(16).padStart(2, "0");
      ctx.strokeStyle = placed[i].color + a;
      ctx.beginPath(); ctx.moveTo(placed[i].x, placed[i].y); ctx.lineTo(placed[j].x, placed[j].y); ctx.stroke();
    }
  }
}

function drawNodes(ctx: CanvasRenderingContext2D, placed: PlacedNode[], pressure: number) {
  for (let i = 0; i < placed.length; i++) {
    const n = placed[i];
    // glow
    const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
    glow.addColorStop(0, n.color + "cc"); glow.addColorStop(1, n.color + "00");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2); ctx.fill();
    // core
    ctx.fillStyle = n.color;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    // kind-glyph
    ctx.fillStyle = "#e6f6ff" + Math.floor(120 + pressure * 100).toString(16);
    ctx.font = "9px ui-monospace, monospace";
    const glyph = n.kind === "trace" ? "·" : n.kind === "fielfold" ? "◆" : n.kind === "task" ? "▣" : n.kind === "walk" ? "→" : "◌";
    ctx.fillText(`${glyph} ${n.label.slice(0, 14)}`, n.x + n.r + 3, n.y - n.r - 2);
  }
}
