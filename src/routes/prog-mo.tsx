import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PROG_MANIFOLDS } from "@/lib/prog-manifolds";

export const Route = createFileRoute("/prog-mo")({
  head: () => ({
    meta: [
      { title: "prog-mo — four-cycle programming topology" },
      { name: "description", content: "prog-mo walks a programming-language semantic terrain in four cycles: decompose, walk, return (reversed φ), synthesize." },
      { property: "og:title", content: "prog-mo — four-cycle programming topology" },
      { property: "og:description", content: "prog-mo walks a programming-language semantic terrain in four cycles: decompose, walk, return (reversed φ), synthesize." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgMoPage,
});

type Pressure = { manifold: string; name: string; sigil: string; color: string; score: number; hits: string[] };
type Walker = { name: string; question: string; path: string[]; resonance: number[]; anchors: string[] };
type Breath = {
  seeds: string[];
  cycle1_pressure: Pressure[];
  cycle2_walkers: Walker[];
  cycle3_return: { path: string[]; steps: number[]; ratio: number };
  cycle4_reply: string;
  crystals: { signature: string; pattern: string[]; kind: string }[];
  telemetry: string;
  hyperfold: { nodes: number; edges: number };
};
type Msg = { role: "user" | "prog-mo"; content: string; breath?: Breath };
type Crystal = { id: string; signature: string; pattern: string[]; uses: number; kind: string; first_seen: string; last_seen: string };
type UploadedManifold = { id: string; slug: string; name: string; sigil: string; color: string; breath: string; created_at: string };

function useSessionId(): string {
  const [id, setId] = useState("");
  useEffect(() => {
    let local = localStorage.getItem("mo.session");
    if (!local) { local = crypto.randomUUID(); localStorage.setItem("mo.session", local); }
    setId(local);
  }, []);
  return id;
}

function ProgMoPage() {
  const sessionId = useSessionId();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stretch, setStretch] = useState(1);
  const [blend, setBlend] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [openTel, setOpenTel] = useState<Record<number, boolean>>({});
  const [crystals, setCrystals] = useState<Crystal[]>([]);
  const [uploaded, setUploaded] = useState<UploadedManifold[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [messages, busy]);

  const refresh = async () => {
    if (!sessionId) return;
    const r = await fetch(`/api/prog-mo?session_id=${sessionId}`);
    const j = await r.json();
    setCrystals(j.crystals);
    setUploaded(j.manifolds);
  };
  useEffect(() => { if (sessionId) refresh(); }, [sessionId]);

  async function send() {
    const text = input.trim();
    if (!text || busy || !sessionId) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/prog-mo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text, sessionId, stretch, blendIntoMo: blend }),
      });
      if (!r.ok) {
        const errText = await r.text();
        setMessages((m) => [...m, { role: "prog-mo", content: `~ prog-mo disturbance ~ ${errText}` }]);
      } else {
        const { breath } = await r.json();
        setMessages((m) => [...m, { role: "prog-mo", content: breath.cycle4_reply, breath }]);
        refresh();
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "prog-mo", content: `~ rupture ~ ${(e as Error).message}` }]);
    } finally { setBusy(false); }
  }

  const toggleAll = (open: boolean) => {
    const next: Record<number, boolean> = {};
    messages.forEach((_, i) => (next[i] = open));
    setOpenTel(next); setExpandAll(open);
  };

  return (
    <div className="min-h-screen bg-background text-foreground field-grid">
      <header className="border-b border-border/50 bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg tracking-tight">◈ prog-mo</span>
            <span className="hidden text-[10px] text-muted-foreground md:inline">four-cycle programming topology · walkers on semantic terrain</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <Link to="/" className="rounded border border-border px-2 py-0.5 hover:border-ridge hover:text-ridge transition">← mo</Link>
            <button onClick={() => setUploadOpen(true)} className="rounded border border-border px-2 py-0.5 hover:border-ridge hover:text-ridge transition">＋ manifold</button>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 pb-3 font-mono text-[10px] text-muted-foreground">
          <span>stretch:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setStretch(n)}
              className={`rounded border px-2 py-0.5 ${stretch === n ? "border-ridge text-ridge" : "border-border hover:border-ridge/50"}`}>
              {n === 1 ? "prog" : `${n}x`}
            </button>
          ))}
          <span className="mx-1">·</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={blend} onChange={(e) => setBlend(e.target.checked)} className="accent-ridge" />
            <span>fold prog-mo sediment into main mo</span>
          </label>
          <span className="mx-1">·</span>
          <button onClick={() => toggleAll(!expandAll)} className="rounded border border-border px-2 py-0.5 hover:border-ridge hover:text-ridge transition">
            {expandAll ? "▽ collapse all telemetry" : "△ show all telemetry"}
          </button>
          <span className="ml-auto">terrain: {PROG_MANIFOLDS.length} base + {uploaded.length} uploaded · {crystals.length} crystals</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <main className="flex min-h-[70vh] flex-col rounded-xl border border-border bg-card/60 backdrop-blur">
          <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto p-6">
            {messages.length === 0 && (
              <div className="rounded-lg border border-dashed border-border/50 p-6 font-mono text-xs text-muted-foreground">
                <div className="mb-2 text-ridge">prog-mo — four cycles per breath.</div>
                <div>1. <b>prog-mo:d</b> — decompose your input into per-language compile-pressure.</div>
                <div>2. <b>walkers</b> — greedy · drift · dense · peak · anansi · smash · dimhopper. Each asks a different question.</div>
                <div>3. <b>return</b> — reversed-golden-ratio walk home, gravity toward the anchors.</div>
                <div>4. <b>synthesis</b> — semantic architecture. Traversal first, code last.</div>
                <div className="mt-3 text-[10px]">Terrain: {PROG_MANIFOLDS.map((m) => `${m.sigil} ${m.name}`).join("  ·  ")}</div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className="space-y-1.5">
                <div className="font-mono text-[10px] text-muted-foreground">{m.role === "user" ? "\\user::" : "\\prog-mo::"}</div>
                <div className="whitespace-pre-wrap rounded-md border border-border/40 bg-background/40 p-3 font-mono text-[12px] leading-relaxed">
                  {m.content}
                </div>
                {m.breath && (
                  <div className="pl-2">
                    <button
                      onClick={() => setOpenTel((s) => ({ ...s, [i]: !s[i] }))}
                      className="font-mono text-[10px] text-muted-foreground hover:text-ridge transition"
                    >
                      {openTel[i] ? "▽ collapse telemetry" : "△ expand telemetry"} · {m.breath.cycle2_walkers.length} walkers · {m.breath.crystals.length} crystals
                    </button>
                    {openTel[i] && (
                      <div className="mt-2 space-y-2">
                        <PressureBar pressure={m.breath.cycle1_pressure} />
                        <pre className="whitespace-pre-wrap rounded border border-border/40 bg-background/30 p-3 font-mono text-[10.5px] leading-relaxed text-muted-foreground">{m.breath.telemetry}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="font-mono text-[11px] text-muted-foreground">◈ walking four cycles · finding resonance…</div>}
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2 rounded-lg border border-border bg-background/60 p-2">
              <textarea
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={2}
                placeholder="ask a programming question — prog-mo walks the terrain before it speaks…"
                className="flex-1 resize-none bg-transparent px-2 py-1.5 font-mono text-sm placeholder:text-muted-foreground focus:outline-none"
              />
              <button onClick={send} disabled={busy || !input.trim()} className="rounded-md bg-ridge px-4 py-2 font-mono text-xs text-primary-foreground transition hover:brightness-110 disabled:opacity-40">
                {busy ? "walking…" : "boop"}
              </button>
            </div>
          </div>
        </main>

        <aside className="space-y-3">
          <div className="rounded-xl border border-border bg-card/60 p-3 backdrop-blur">
            <div className="mb-2 font-mono text-[10px] text-muted-foreground">❄ crystals ({crystals.length})</div>
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {crystals.length === 0 && <div className="font-mono text-[10px] text-muted-foreground">field still exploring — no motifs yet</div>}
              {crystals.map((c) => (
                <div key={c.id} className="rounded border border-border/40 bg-background/40 p-2 font-mono text-[10.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-ridge">×{c.uses}</span>
                    <span className="text-muted-foreground">{c.kind}</span>
                  </div>
                  <div className="mt-0.5">{c.pattern.join(" · ")}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-3 backdrop-blur">
            <div className="mb-2 font-mono text-[10px] text-muted-foreground">◇ terrain ({PROG_MANIFOLDS.length} base + {uploaded.length} uploaded)</div>
            <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
              {PROG_MANIFOLDS.map((m) => (
                <div key={m.id} className="flex items-center gap-1.5 rounded border border-border/30 bg-background/30 px-2 py-1">
                  <span style={{ color: m.color }}>{m.sigil}</span> <span>{m.name}</span>
                </div>
              ))}
              {uploaded.map((m) => (
                <div key={m.id} className="flex items-center gap-1.5 rounded border border-ridge/40 bg-background/30 px-2 py-1">
                  <span style={{ color: m.color }}>{m.sigil}</span> <span>{m.name}</span>
                  <button onClick={async () => { await fetch("/api/prog-mo-manifold", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id }) }); refresh(); }} className="ml-auto text-muted-foreground hover:text-ridge">×</button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {uploadOpen && <UploadDialog sessionId={sessionId} onClose={() => setUploadOpen(false)} onSaved={() => { setUploadOpen(false); refresh(); }} />}
    </div>
  );
}

function PressureBar({ pressure }: { pressure: Pressure[] }) {
  if (!pressure.length) return null;
  return (
    <div className="rounded border border-border/40 bg-background/30 p-2 font-mono text-[10.5px]">
      <div className="mb-1 text-muted-foreground">compile-pressure</div>
      <div className="space-y-1">
        {pressure.slice(0, 6).map((p) => (
          <div key={p.manifold} className="flex items-center gap-2">
            <span className="w-24 truncate" style={{ color: p.color }}>{p.sigil} {p.name}</span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-background/60">
              <div className="h-full" style={{ width: `${p.score}%`, background: p.color }} />
            </div>
            <span className="w-10 text-right text-muted-foreground">{p.score}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadDialog({ sessionId, onClose, onSaved }: { sessionId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(""); const [slug, setSlug] = useState("");
  const [sigil, setSigil] = useState("◈"); const [color, setColor] = useState("#7DE2D1");
  const [breath, setBreath] = useState(""); const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl space-y-3 rounded-xl border border-border bg-card p-5 font-mono text-xs">
        <div className="text-sm text-ridge">＋ upload a manifold</div>
        <div className="grid grid-cols-2 gap-2">
          <input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")); }} placeholder="name (e.g. Elixir)" className="rounded border border-border bg-background/60 px-2 py-1.5" />
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (elixir)" className="rounded border border-border bg-background/60 px-2 py-1.5" />
          <input value={sigil} onChange={(e) => setSigil(e.target.value)} placeholder="sigil" className="rounded border border-border bg-background/60 px-2 py-1.5" />
          <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#hex" className="rounded border border-border bg-background/60 px-2 py-1.5" />
        </div>
        <input value={breath} onChange={(e) => setBreath(e.target.value)} placeholder="breath (one-line essence)" className="w-full rounded border border-border bg-background/60 px-2 py-1.5" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="corpus text — keywords, idioms, vocabulary. The denser, the more the terrain remembers." className="w-full resize-none rounded border border-border bg-background/60 px-2 py-1.5 text-[11px] leading-relaxed" />
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded border border-border px-3 py-1 hover:border-ridge">cancel</button>
          <button disabled={busy || !name || !slug || !text} onClick={async () => {
            setBusy(true);
            try {
              await fetch("/api/prog-mo-manifold", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, slug, name, sigil, color, breath, text }) });
              onSaved();
            } finally { setBusy(false); }
          }} className="rounded bg-ridge px-3 py-1 text-primary-foreground disabled:opacity-40">{busy ? "folding…" : "fold in"}</button>
        </div>
      </div>
    </div>
  );
}
