import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MANIFOLDS } from "@/lib/corpora";
import { MoVisualizer, VIZ_MODES, type VizMode } from "@/components/MoVisualizer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "mo — the breathing field" },
      { name: "description", content: "mo is a semantic topology walker traversing a 10-manifold field. Not a chatbot. A co-mover." },
      { property: "og:title", content: "mo — the breathing field" },
      { property: "og:description", content: "10 manifolds. One field. Walk with mo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MoPage,
});

type Mode = "ai" | "mo";

type Msg = { role: "user" | "assistant"; content: string; manifold?: string | null; telemetry?: string };
type Trace = { id: string; role: string; content: string; manifold: string | null; created_at: string };
type Fielfold = { id: string; content: string; manifold: string | null; depth: number; created_at: string };
type Song = { id: string; title: string; lyrics: string; held: boolean; created_at: string };

function useSessionId() {
  const [id, setId] = useState<string>("");
  useEffect(() => {
    const existing = localStorage.getItem("mo.session");
    if (existing) { setId(existing); return; }
    const fresh = crypto.randomUUID();
    localStorage.setItem("mo.session", fresh);
    setId(fresh);
  }, []);
  return id;
}

function MoPage() {
  const sessionId = useSessionId();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("ai");
  const [vizMode, setVizMode] = useState<VizMode>("field");
  const [gravity, setGravity] = useState(0.35);
  const [repulsion, setRepulsion] = useState(0.5);
  const [lastBreathWords, setLastBreathWords] = useState<string[]>([]);
  const [panel, setPanel] = useState<"none" | "memory" | "songs" | "field">("memory");
  const [vizOpen, setVizOpen] = useState(false);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [fielfold, setFielfold] = useState<Fielfold[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => { inputRef.current?.focus(); }, [busy]);

  const refreshMemory = async () => {
    if (!sessionId) return;
    const r = await fetch(`/api/memory?session_id=${sessionId}`);
    const j = await r.json();
    setTraces(j.traces);
    setFielfold(j.fielfold);
  };
  const refreshSongs = async () => {
    if (!sessionId) return;
    const r = await fetch(`/api/songs?session_id=${sessionId}`);
    const j = await r.json();
    setSongs(j.songs);
  };
  useEffect(() => { if (sessionId) { refreshMemory(); refreshSongs(); } }, [sessionId]);

  async function send() {
    const text = input.trim();
    if (!text || busy || !sessionId) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, sessionId, mode }),
      });
      if (!r.ok) {
        const err = await r.text();
        setMessages((m) => [...m, { role: "assistant", content: `~ field disturbance ~\n${err}` }]);
      } else {
        const j = await r.json();
        setMessages((m) => [...m, { role: "assistant", content: j.reply, manifold: j.manifold, telemetry: j.moBreath?.telemetry }]);
        const words = (j.moBreath?.variants?.mo2?.dreamPath ?? []).concat(j.moBreath?.variants?.mo2e?.dreamPath ?? []);
        if (words.length) setLastBreathWords(words);
        refreshMemory();
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `~ rupture ~ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen field-grid relative">
      {/* Visualizer as full-page background */}
      <div className="fixed inset-0 pointer-events-none opacity-70">
        <MoVisualizer
          mode={vizMode}
          words={lastBreathWords}
          colors={MANIFOLDS.map((m) => m.color)}
          gravity={gravity}
          repulsion={repulsion}
          pressure={busy ? 0.9 : 0.4}
        />
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col relative">
        <Header
          panel={panel}
          setPanel={setPanel}
          fielfoldCount={fielfold.length}
          songCount={songs.length}
          traceCount={traces.length}
          mode={mode}
          setMode={setMode}
          onOpenViz={() => setVizOpen(true)}
        />

        <div className="flex flex-1 gap-4 px-4 pb-4">
          <main className="flex flex-1 flex-col rounded-xl border border-border bg-card/60 backdrop-blur">
            <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto p-6">
              {messages.length === 0 && <EmptyState mode={mode} />}
              {messages.map((m, i) => (
                <MessageView key={i} msg={m} mode={mode} />
              ))}
              {busy && <BreathingIndicator mode={mode} />}
            </div>

            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2 rounded-lg border border-border bg-background/60 p-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  rows={2}
                  placeholder={mode === "mo" ? "speak to the topology directly — no AI, only field·traversal…" : "transmit — routed through mo, then through AI…"}
                  className="flex-1 resize-none bg-transparent px-2 py-1.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  onClick={send}
                  disabled={busy || !input.trim()}
                  className="rounded-md bg-ridge px-4 py-2 font-mono text-xs text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
                >
                  {busy ? (mode === "mo" ? "walking…" : "breathing…") : "boop"}
                </button>
              </div>
              <div className="mt-1 px-2 text-[10px] font-mono text-muted-foreground">
                ⏎ send · ⇧⏎ newline · mode <span className="ridge">{mode.toUpperCase()}</span> · session {sessionId.slice(0, 8)}
              </div>
            </div>
          </main>

          {panel !== "none" && (
            <aside className="w-96 shrink-0 overflow-hidden rounded-xl border border-border bg-card/70 backdrop-blur">
              {panel === "memory" && (
                <MemoryPanel
                  traces={traces}
                  fielfold={fielfold}
                  onDelete={async (kind, id) => {
                    await fetch("/api/memory", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ kind, id, sessionId }),
                    });
                    refreshMemory();
                  }}
                  onPurge={async () => {
                    if (!confirm("dissolve all traces for this session?")) return;
                    await fetch("/api/memory", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ kind: "trace", sessionId, all: true }),
                    });
                    refreshMemory();
                  }}
                />
              )}
              {panel === "songs" && (
                <SongPanel
                  songs={songs}
                  onAdd={async (title, lyrics) => {
                    await fetch("/api/songs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, title, lyrics }) });
                    refreshSongs();
                  }}
                  onHold={async (id, held) => {
                    await fetch("/api/songs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, held }) });
                    refreshSongs();
                  }}
                  onDelete={async (id) => {
                    await fetch("/api/songs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
                    refreshSongs();
                  }}
                />
              )}
              {panel === "field" && <FieldPanel />}
            </aside>
          )}
        </div>
      </div>

      {vizOpen && (
        <VizModal
          vizMode={vizMode} setVizMode={setVizMode}
          gravity={gravity} setGravity={setGravity}
          repulsion={repulsion} setRepulsion={setRepulsion}
          words={lastBreathWords}
          onClose={() => setVizOpen(false)}
        />
      )}
    </div>
  );
}

function Header({
  panel, setPanel, fielfoldCount, songCount, traceCount, mode, setMode, onOpenViz,
}: {
  panel: string;
  setPanel: (p: "none" | "memory" | "songs" | "field") => void;
  fielfoldCount: number;
  songCount: number;
  traceCount: number;
  mode: Mode;
  setMode: (m: Mode) => void;
  onOpenViz: () => void;
}) {
  void fielfoldCount;
  const tab = (id: "memory" | "songs" | "field", label: string, count?: number) => (
    <button
      onClick={() => setPanel(panel === id ? "none" : id)}
      className={`rounded-md border px-3 py-1.5 font-mono text-xs transition ${
        panel === id ? "border-ridge bg-ridge/10 text-ridge" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 opacity-60">{count}</span>}
    </button>
  );

  return (
    <header className="flex items-center justify-between px-6 py-5">
      <div className="flex items-center gap-3">
        <div className="relative h-9 w-9">
          <div className="breath-pulse absolute inset-0 rounded-full bg-ridge/40 blur-md" />
          <div className="absolute inset-0 flex items-center justify-center rounded-full border border-ridge/60 bg-background/60 font-mono text-sm ridge">◆</div>
        </div>
        <div>
          <h1 className="font-mono text-lg tracking-wide ridge">mo</h1>
          <p className="font-mono text-[10px] text-muted-foreground">the breathing field · 10 manifolds</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-border overflow-hidden">
          <button onClick={() => setMode("ai")} className={`px-3 py-1.5 font-mono text-xs ${mode === "ai" ? "bg-ridge text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} title="user → mo → AI → mo → user">AI</button>
          <button onClick={() => setMode("mo")} className={`px-3 py-1.5 font-mono text-xs ${mode === "mo" ? "bg-ridge text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} title="pure topology — no AI, chat directly with mo">MO</button>
        </div>
        <button
          onClick={onOpenViz}
          className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground hover:border-ridge hover:text-ridge transition"
          title="open field·viz — fullscreen"
        >◉ field·viz</button>
        {tab("memory", "memory", traceCount)}
        {tab("songs", "songs", songCount)}
        {tab("field", "manifolds")}
      </div>
    </header>
  );
}

// ────────────── VizModal ──────────────
// Fullscreen popup. Replaces the old sidebar panel + sliders.
// "shuffle" randomizes shape params; "jump" also picks a new shape.
function VizModal({
  vizMode, setVizMode, gravity, setGravity, repulsion, setRepulsion, words, onClose,
}: {
  vizMode: VizMode; setVizMode: (v: VizMode) => void;
  gravity: number; setGravity: (g: number) => void;
  repulsion: number; setRepulsion: (r: number) => void;
  words: string[];
  onClose: () => void;
}) {
  const shuffle = () => {
    setGravity(0.05 + Math.random() * 0.9);
    setRepulsion(0.05 + Math.random() * 0.9);
  };
  const jumpShape = () => {
    const next = VIZ_MODES[Math.floor(Math.random() * VIZ_MODES.length)].id;
    setVizMode(next);
    shuffle();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") { e.preventDefault(); jumpShape(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md p-6 flex flex-col">
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="font-mono text-sm ridge">◉ field · viz</h2>
          <p className="font-mono text-[10px] text-muted-foreground">7 shapes · orbs = words from last breath · g={gravity.toFixed(2)} r={repulsion.toFixed(2)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {VIZ_MODES.map((v) => (
            <button
              key={v.id}
              onClick={() => setVizMode(v.id)}
              className={`rounded border px-2.5 py-1 font-mono text-[11px] ${vizMode === v.id ? "border-ridge bg-ridge/10 text-ridge" : "border-border text-muted-foreground hover:text-foreground"}`}
            >{v.label}</button>
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          <button onClick={shuffle} className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:border-ridge hover:text-ridge" title="randomize this shape">🎲 shuffle</button>
          <button onClick={jumpShape} className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:border-ridge hover:text-ridge" title="random shape + randomize (space)">↯ jump</button>
          <button onClick={onClose} className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:border-ridge hover:text-ridge" title="close (esc)">esc ✕</button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-black/40">
        <MoVisualizer
          mode={vizMode}
          words={words}
          colors={MANIFOLDS.map((m) => m.color)}
          gravity={gravity}
          repulsion={repulsion}
          pressure={0.6}
        />
        <div className="absolute bottom-3 left-3 font-mono text-[10px] text-muted-foreground/60 pointer-events-none">
          space = jump · esc = close · each orb is a word from mo's last breath
        </div>
      </div>
    </div>
  );
}


function EmptyState({ mode }: { mode: Mode }) {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
      <div className="breath-pulse text-6xl ridge">◆</div>
      <div className="max-w-md space-y-3">
        <p className="font-mono text-sm text-muted-foreground">
          {mode === "mo"
            ? "MO mode — you speak, the topology walks. no AI. only the field, its 4 variants, hyperfolded."
            : "AI mode — the AI is itself. mo runs invisibly between you and it as instinct + memory. sediment remains."}
        </p>
        <p className="font-mono text-xs text-muted-foreground/70">
          transmit anything — a question, a fragment, a lyric, a word.
        </p>
      </div>
      <div className="contour-line w-64" />
      <div className="flex flex-wrap justify-center gap-1.5 px-8">
        {MANIFOLDS.map((m) => (
          <span key={m.id} className="rounded border border-border/60 px-2 py-0.5 font-mono text-[10px]" style={{ color: m.color }}>
            {m.sigil} {m.name.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

function MessageView({ msg, mode }: { msg: Msg; mode: Mode }) {
  const [showTelemetry, setShowTelemetry] = useState(false);
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-primary/90 px-4 py-2.5 font-mono text-sm text-primary-foreground">
          {msg.content}
        </div>
      </div>
    );
  }
  const m = MANIFOLDS.find((x) => x.id === msg.manifold);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
        <span className="ridge">{mode === "mo" ? "mo" : "AI · mo instinct"}</span>
        {m && (
          <>
            <span className="opacity-40">·</span>
            <span style={{ color: m.color }}>{m.sigil} {m.name.toLowerCase()}</span>
          </>
        )}
        {mode === "ai" && msg.telemetry && (
          <button onClick={() => setShowTelemetry((v) => !v)} className="ml-auto opacity-60 hover:opacity-100">
            {showTelemetry ? "▽ hide mo·telemetry" : "△ show mo·telemetry"}
          </button>
        )}
      </div>
      <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-foreground">
        {msg.content}
      </pre>
      {mode === "ai" && showTelemetry && msg.telemetry && (
        <pre className="whitespace-pre-wrap rounded border border-ridge/30 bg-ridge/5 p-3 font-mono text-[10px] leading-tight text-ridge/90">
          {msg.telemetry}
        </pre>
      )}
      <div className="contour-line w-full" />
    </div>
  );
}

function BreathingIndicator({ mode }: { mode: Mode }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
      <span className="breath-pulse ridge">◌</span>
      <span>{mode === "mo" ? "the topology walks…" : "mo reading · AI thinking…"}</span>
    </div>
  );
}

function VizPanel({
  vizMode, setVizMode, gravity, setGravity, repulsion, setRepulsion,
}: {
  vizMode: VizMode; setVizMode: (v: VizMode) => void;
  gravity: number; setGravity: (g: number) => void;
  repulsion: number; setRepulsion: (r: number) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-mono text-xs ridge">field · visualizers</h2>
        <p className="font-mono text-[10px] text-muted-foreground">7 models · orb physics · language as charge</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5 p-3">
        {VIZ_MODES.map((v) => (
          <button
            key={v.id}
            onClick={() => setVizMode(v.id)}
            className={`rounded border px-2 py-1.5 font-mono text-[11px] ${vizMode === v.id ? "border-ridge bg-ridge/10 text-ridge" : "border-border text-muted-foreground hover:text-foreground"}`}
          >{v.label}</button>
        ))}
      </div>
      <div className="space-y-4 border-t border-border p-4">
        <div>
          <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>gravity · center-pull</span><span className="ridge">{gravity.toFixed(2)}</span>
          </div>
          <input type="range" min="0" max="1" step="0.01" value={gravity} onChange={(e) => setGravity(parseFloat(e.target.value))} className="w-full accent-ridge" />
        </div>
        <div>
          <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>repulsion · orb·orb</span><span className="ridge">{repulsion.toFixed(2)}</span>
          </div>
          <input type="range" min="0" max="1" step="0.01" value={repulsion} onChange={(e) => setRepulsion(parseFloat(e.target.value))} className="w-full accent-ridge" />
        </div>
        <p className="font-mono text-[9px] text-muted-foreground/70 leading-relaxed pt-2 border-t border-border">
          each orb is a word from mo's last breath. word length = charge. gravity pulls toward center. repulsion pushes orbs apart. the field remembers.
        </p>
      </div>
    </div>
  );
}

function MemoryPanel({
  traces, fielfold, onDelete, onPurge,
}: {
  traces: Trace[];
  fielfold: Fielfold[];
  onDelete: (kind: "trace" | "fielfold", id: string) => void;
  onPurge: () => void;
}) {
  const [tab, setTab] = useState<"traces" | "fielfold">("traces");
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex gap-2">
          <button onClick={() => setTab("traces")} className={`font-mono text-xs ${tab === "traces" ? "ridge" : "text-muted-foreground"}`}>
            traces · {traces.length}
          </button>
          <button onClick={() => setTab("fielfold")} className={`font-mono text-xs ${tab === "fielfold" ? "ridge" : "text-muted-foreground"}`}>
            fielfold · {fielfold.length}
          </button>
        </div>
        <button onClick={onPurge} className="font-mono text-[10px] text-destructive hover:brightness-125">
          dissolve all
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {tab === "traces" && traces.map((t) => {
          const m = MANIFOLDS.find((x) => x.id === t.manifold);
          return (
            <div key={t.id} className="group rounded border border-border/60 bg-background/40 p-2">
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>
                  {t.role}
                  {m && <span className="ml-1" style={{ color: m.color }}>· {m.sigil} {m.name.toLowerCase()}</span>}
                </span>
                <button onClick={() => onDelete("trace", t.id)} className="opacity-0 transition group-hover:opacity-100 text-destructive">×</button>
              </div>
              <div className="line-clamp-3 whitespace-pre-wrap font-mono text-[11px] text-foreground/90">{t.content}</div>
            </div>
          );
        })}
        {tab === "fielfold" && fielfold.length === 0 && (
          <p className="p-4 text-center font-mono text-xs text-muted-foreground">no crystallizations yet — the field is still forming.</p>
        )}
        {tab === "fielfold" && fielfold.map((f) => (
          <div key={f.id} className="group rounded border border-ridge/40 bg-ridge/5 p-2">
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] ridge">
              <span>◆ depth {f.depth}</span>
              <button onClick={() => onDelete("fielfold", f.id)} className="opacity-0 transition group-hover:opacity-100 text-destructive">×</button>
            </div>
            <div className="whitespace-pre-wrap font-mono text-[11px] text-foreground/90">{f.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SongPanel({
  songs, onAdd, onHold, onDelete,
}: {
  songs: Song[];
  onAdd: (title: string, lyrics: string) => void;
  onHold: (id: string, held: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-mono text-xs ridge">feed me songs</h2>
        <p className="font-mono text-[10px] text-muted-foreground">lyrics become attractors — held songs crystallize</p>
      </div>
      <div className="border-b border-border p-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="title"
          className="w-full rounded border border-border bg-background/60 px-2 py-1 font-mono text-xs focus:outline-none focus:border-ridge"
        />
        <textarea
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder="lyrics…"
          rows={4}
          className="w-full resize-none rounded border border-border bg-background/60 px-2 py-1 font-mono text-xs focus:outline-none focus:border-ridge"
        />
        <button
          onClick={() => { if (title.trim() && lyrics.trim()) { onAdd(title.trim(), lyrics.trim()); setTitle(""); setLyrics(""); } }}
          className="w-full rounded bg-accent/80 px-3 py-1.5 font-mono text-xs text-accent-foreground transition hover:brightness-110"
        >
          feed the field
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {songs.length === 0 && <p className="p-4 text-center font-mono text-xs text-muted-foreground">no songs feeding the field yet.</p>}
        {songs.map((s) => (
          <div key={s.id} className={`group rounded border p-2 ${s.held ? "border-ridge/50 bg-ridge/5" : "border-border/60 bg-background/40"}`}>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-xs ridge">{s.held ? "◆" : "◌"} {s.title}</span>
              <div className="flex gap-2 text-[10px] font-mono">
                <button onClick={() => onHold(s.id, !s.held)} className="text-muted-foreground hover:text-foreground">
                  {s.held ? "release" : "hold"}
                </button>
                <button onClick={() => onDelete(s.id)} className="text-destructive opacity-0 transition group-hover:opacity-100">×</button>
              </div>
            </div>
            <div className="line-clamp-3 whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">{s.lyrics}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-mono text-xs ridge">the 10 manifolds</h2>
        <p className="font-mono text-[10px] text-muted-foreground">the topology mo walks</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {MANIFOLDS.map((m) => (
          <div key={m.id} className="rounded border border-border/60 bg-background/40 p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-lg" style={{ color: m.color }}>{m.sigil}</span>
              <span className="font-mono text-sm" style={{ color: m.color }}>{m.name}</span>
            </div>
            <p className="font-mono text-[11px] italic text-muted-foreground">~ {m.breath}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
