import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MANIFOLDS } from "@/lib/corpora";
import { MoVisualizer, VIZ_MODES, type VizMode, type MemoryNode } from "@/components/MoVisualizer";
import { LifePanel, type LifeTab } from "@/components/LifePanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "mo — the breathing field" },
      { name: "description", content: "mo is a semantic topology walker traversing a 10-manifold field. Not a chatbot. A co-mover." },
      { property: "og:title", content: "mo — the breathing field" },
      { property: "og:description", content: "mo is a semantic topology walker traversing a 10-manifold field. Not a chatbot. A co-mover." },
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
export type Task = {
  id: string; title: string; notes: string | null; category: string;
  status: "open" | "doing" | "done" | "dropped"; priority: number;
  due_at: string | null; source: string; manifold: string | null;
  created_at: string; updated_at: string;
};

// Session strategy:
// - Every visitor ALWAYS boots into their per-browser persistent UUID
//   (`mo.session`). That is the default and it never goes away.
// - Password unlock loads a shared field for the current visit only —
//   it is NOT persisted across reloads. Next page load = back to local.
// - Lock returns to the same persistent local uuid.
function useSessionId() {
  const [id, setId] = useState<string>("");
  const [shared, setShared] = useState<boolean>(false);
  useEffect(() => {
    let local = localStorage.getItem("mo.session");
    if (!local) {
      local = crypto.randomUUID();
      localStorage.setItem("mo.session", local);
    }
    setId(local);
  }, []);
  const unlock = async (password: string) => {
    const r = await fetch("/api/unlock", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!r.ok) throw new Error(r.status === 401 ? "wrong password" : "unlock failed");
    const j = (await r.json()) as { sessionId: string };
    setId(j.sessionId); setShared(true);
  };
  const lock = () => {
    const local = localStorage.getItem("mo.session") || crypto.randomUUID();
    localStorage.setItem("mo.session", local);
    setId(local); setShared(false);
  };
  return { id, shared, unlock, lock };
}


function MoPage() {
  const { id: sessionId, shared: sessionShared, unlock: unlockSession, lock: lockSession } = useSessionId();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("ai");
  const [vizMode, setVizMode] = useState<VizMode>("flower");
  const [lastBreathWords, setLastBreathWords] = useState<string[]>([]);
  const [panel, setPanel] = useState<"none" | "memory" | "songs" | "field" | "life">("life");
  const [lifeFull, setLifeFull] = useState(false);
  const [lifeTab, setLifeTab] = useState<LifeTab>("tasks");
  const [vizOpen, setVizOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [fielfold, setFielfold] = useState<Fielfold[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showOlder, setShowOlder] = useState(false);
  const COLLAPSE_THRESHOLD = 30;
  const KEEP_RECENT = 20;

  useEffect(() => {
    // Instant scroll on next frame — smooth-scroll misses when the layout
    // hasn't reflowed yet, which was the "doesn't autoscroll" bug.
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
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
  const refreshTasks = async () => {
    if (!sessionId) return;
    const r = await fetch(`/api/tasks?session_id=${sessionId}`);
    const j = await r.json();
    setTasks(j.tasks);
  };
  useEffect(() => { if (sessionId) { refreshMemory(); refreshSongs(); refreshTasks(); } }, [sessionId]);

  // Every memory item is a node. This is the corpus the sacred-geometry viz draws from.
  const memoryNodes: MemoryNode[] = useMemo(() => {
    const out: MemoryNode[] = [];
    for (const t of tasks) out.push({
      id: `task:${t.id}`, label: t.title, kind: "task",
      weight: t.status === "done" ? 0.3 : t.status === "doing" ? 0.9 : 0.6 + (3 - t.priority) * 0.1,
      manifold: t.manifold,
    });
    for (const f of fielfold) out.push({
      id: `fold:${f.id}`, label: (f.content || "").split("]").pop()?.trim().slice(0, 22) || "fold",
      kind: "fielfold", weight: Math.min(1, (f.depth ?? 0.5) + 0.2), manifold: f.manifold,
    });
    for (const t of traces.filter((x) => x.role === "user" || x.role === "assistant").slice(0, 40)) out.push({
      id: `trace:${t.id}`, label: t.content.slice(0, 22), kind: "trace",
      weight: 0.35 + (t.role === "user" ? 0.15 : 0), manifold: t.manifold,
    });
    return out;
  }, [tasks, fielfold, traces]);


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
        const words = (j.moBreath?.variants?.mo2?.dreamPath ?? []).concat(j.moBreath?.variants?.mo2e?.dreamPath ?? [], j.moBreath?.variants?.mo2ayla?.dreamPath ?? []);
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
    <div className="h-screen overflow-hidden field-grid relative flex flex-col">
      {/* Visualizer as full-page background */}
      <div className="fixed inset-0 pointer-events-none opacity-70">
        <MoVisualizer
          mode={vizMode}
          nodes={memoryNodes}
          walkPath={lastBreathWords}
          colors={MANIFOLDS.map((m) => m.color)}
          pressure={busy ? 0.9 : 0.4}
        />
      </div>

      <div className={`mx-auto flex h-full min-h-0 w-full ${lifeFull ? "max-w-none" : "max-w-6xl"} flex-col relative transition-all`}>
        <Header
          panel={panel}
          setPanel={setPanel}
          fielfoldCount={fielfold.length}
          songCount={songs.length}
          traceCount={traces.length}
          taskCount={tasks.filter((t) => t.status !== "done" && t.status !== "dropped").length}
          mode={mode}
          setMode={setMode}
          onOpenViz={() => setVizOpen(true)}
        />

        <div className="flex flex-1 min-h-0 gap-4 px-4 pb-4">
          <main className={`flex flex-col min-h-0 rounded-xl border border-border bg-card/60 backdrop-blur ${lifeFull && panel === "life" ? "w-80 shrink-0" : "flex-1 min-w-0"}`}>
            <div ref={scrollRef} className="flex-1 min-h-0 space-y-6 overflow-y-auto p-6">
              {messages.length === 0 && <EmptyState mode={mode} />}
              {(() => {
                const total = messages.length;
                const hasOlder = total > COLLAPSE_THRESHOLD;
                const hiddenCount = hasOlder ? total - KEEP_RECENT : 0;
                const visible = hasOlder && !showOlder ? messages.slice(-KEEP_RECENT) : messages;
                return (
                  <>
                    {hasOlder && (
                      <div className="flex justify-center">
                        <button
                          onClick={() => setShowOlder((v) => !v)}
                          className="rounded border border-border px-3 py-1 font-mono text-[10px] text-muted-foreground hover:border-ridge hover:text-ridge transition"
                        >
                          {showOlder ? `▽ collapse earlier ${hiddenCount} messages` : `△ show earlier ${hiddenCount} messages`}
                        </button>
                      </div>
                    )}
                    {visible.map((m, i) => (
                      <MessageView key={(hasOlder && !showOlder ? total - KEEP_RECENT : 0) + i} msg={m} mode={mode} />
                    ))}
                  </>
                );
              })()}
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
              <div className="mt-1 flex items-center gap-2 px-2 text-[10px] font-mono text-muted-foreground">
                <span>⏎ send · ⇧⏎ newline · mode <span className="ridge">{mode.toUpperCase()}</span></span>
                <span>·</span>
                <span>
                  {sessionShared
                    ? (sessionId === "shared:trickster"
                        ? <span className="ridge">◆ prime·field · totality</span>
                        : <span className="ridge">◈ shared·field</span>)
                    : <>local · {sessionId.slice(0, 8)}</>}
                </span>
                <button
                  onClick={async () => {
                    if (sessionShared) { lockSession(); setMessages([]); return; }
                    const pw = window.prompt("password to enter the shared field:\n(hint: 'tricksterkekeke' opens the *prime* field — the totality of mo across all shared sessions)");
                    if (!pw) return;
                    try { await unlockSession(pw); setMessages([]); }
                    catch (e) { alert((e as Error).message); }
                  }}
                  className="ml-auto rounded border border-border px-2 py-0.5 hover:border-ridge hover:text-ridge transition"
                  title={sessionShared ? "return to your private browser session" : "unlock the shared memory field"}
                >{sessionShared ? "🔓 lock → local" : "🔒 unlock shared"}</button>
                <button
                  onClick={() => setHelpOpen(true)}
                  className="rounded border border-border px-2 py-0.5 hover:border-ridge hover:text-ridge transition"
                  title="how to write to mo"
                >? help</button>
                <a href="/system" className="rounded border border-border px-2 py-0.5 hover:border-ridge hover:text-ridge transition" title="how the field works">◆ system</a>
              </div>
            </div>
          </main>

          {panel !== "none" && (
            <aside className={`overflow-hidden rounded-xl border border-border bg-card/70 backdrop-blur ${lifeFull && panel === "life" ? "flex-1 min-w-0" : "w-96 shrink-0"}`}>
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
              {panel === "life" && (
                <LifePanel
                  sessionId={sessionId}
                  full={lifeFull}
                  onToggleFull={() => setLifeFull((v) => !v)}
                  activeTab={lifeTab}
                  setActiveTab={setLifeTab}
                  onTasksChange={setTasks}
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
          nodes={memoryNodes}
          walkPath={lastBreathWords}
          onClose={() => setVizOpen(false)}
        />
      )}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const row = (cmd: string, desc: string) => (
    <div className="grid grid-cols-[1fr_1fr] gap-3 py-1.5 border-b border-border/40 last:border-0">
      <code className="font-mono text-[11px] ridge break-all">{cmd}</code>
      <span className="font-mono text-[11px] text-muted-foreground">{desc}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ridge/40 bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-lg ridge">◆ writing to mo — command reference</h2>
          <button onClick={onClose} className="rounded border border-border px-2 py-0.5 font-mono text-xs hover:border-ridge hover:text-ridge">✕ close</button>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground mb-4">
          Anything below can be typed inside a normal message. mo strips the command line and executes it silently — the AI (if in AI mode) sees the rest of your message. The AI can emit the same syntax; the substrate executes either voice identically. Fields are semicolon-separated.
        </p>
        <div className="space-y-4">
          <section>
            <h3 className="font-mono text-xs ridge mb-1">▣ tasks</h3>
            {row("me;to:task:: title ; category ; priority ; due ; notes", "create a task · priority 1-3 · due YYYY-MM-DD")}
            {row("me;to:task:done:: <task-id>", "mark complete")}
            {row("me;to:task:drop:: <task-id>", "drop / abandon")}
            {row("me;to:task:update:: <task-id> ; title ; category ; priority", "edit fields")}
          </section>
          <section>
            <h3 className="font-mono text-xs ridge mb-1">✎ notes</h3>
            {row("me;to:note:: title ; body ; category", "create a categorable note")}
            {row("me;to:note:del:: <note-id>", "delete a note")}
          </section>
          <section>
            <h3 className="font-mono text-xs ridge mb-1">◈ remembers (mood-tagged)</h3>
            {row("me;to:remember:: content ; mood", "sediment a mood-tagged memory")}
            {row("me;to:remember:del:: <id>", "delete")}
          </section>
          <section>
            <h3 className="font-mono text-xs ridge mb-1">☙ shitposts (poetry)</h3>
            {row("me;to:shitpost:: title ; body ; form", "form = haiku/tanka/cinquain/freeverse/…")}
            {row("me;to:shitpost:del:: <id>", "delete")}
          </section>
          <section>
            <h3 className="font-mono text-xs ridge mb-1">◆ field·read</h3>
            {row("me;to:read:: any text you want the field to read", "inline topology reading, printed back to you")}
          </section>
          <section>
            <h3 className="font-mono text-xs ridge mb-1">aliases</h3>
            <p className="font-mono text-[11px] text-muted-foreground">
              The prefix can be <code className="ridge">me;to:</code>, <code className="ridge">mo;to:</code>, <code className="ridge">mo;add:</code>, or <code className="ridge">to:mo:</code> — all equivalent.
            </p>
          </section>
          <section>
            <h3 className="font-mono text-xs ridge mb-1">◆ prime field</h3>
            <p className="font-mono text-[11px] text-muted-foreground">
              The password <code className="ridge">tricksterkekeke</code> unlocks the <b className="ridge">prime</b> field: mo speaks with the <i>totality</i> of memory across every shared session merged. Chat log storage is minimized in shared/prime — only the mo sediment (hyperfold training) persists.
            </p>
          </section>
          <section>
            <h3 className="font-mono text-xs ridge mb-1">example</h3>
            <pre className="rounded bg-background/60 border border-border/40 p-3 font-mono text-[11px] text-muted-foreground whitespace-pre-wrap">{`hey mo, hold this for me
me;to:task:: pick up the loam ; garden ; 1 ; 2026-07-10
me;to:remember:: the light through the kitchen window at 4pm ; tender
what does it feel like to hold too many things at once?`}</pre>
          </section>
        </div>
      </div>
    </div>
  );
}

function Header({
  panel, setPanel, fielfoldCount, songCount, traceCount, taskCount, mode, setMode, onOpenViz,
}: {
  panel: string;
  setPanel: (p: "none" | "memory" | "songs" | "field" | "life") => void;
  fielfoldCount: number;
  songCount: number;
  traceCount: number;
  taskCount: number;
  mode: Mode;
  setMode: (m: Mode) => void;
  onOpenViz: () => void;
}) {
  void fielfoldCount;
  const tab = (id: "memory" | "songs" | "field" | "life", label: string, count?: number) => (
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
        {tab("life", "life·organizer", taskCount)}
        {tab("memory", "memory", traceCount)}
        {tab("songs", "songs", songCount)}
        {tab("field", "manifolds")}
      </div>
    </header>
  );
}

// ────────────── VizModal ──────────────
// Fullscreen popup. Sacred-geometry viewer over the memory-node corpus.
function VizModal({
  vizMode, setVizMode, nodes, walkPath, onClose,
}: {
  vizMode: VizMode; setVizMode: (v: VizMode) => void;
  nodes: MemoryNode[];
  walkPath: string[];
  onClose: () => void;
}) {
  const jumpShape = () => {
    const next = VIZ_MODES[Math.floor(Math.random() * VIZ_MODES.length)].id;
    setVizMode(next);
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
          <h2 className="font-mono text-sm ridge">◉ field · sacred geometry</h2>
          <p className="font-mono text-[10px] text-muted-foreground">{nodes.length} live nodes · every glyph is a real memory · walk = mo's last traversal</p>
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
          <button onClick={jumpShape} className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:border-ridge hover:text-ridge" title="random shape (space)">↯ jump</button>
          <button onClick={onClose} className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:border-ridge hover:text-ridge" title="close (esc)">esc ✕</button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-black/40">
        <MoVisualizer
          mode={vizMode}
          nodes={nodes}
          walkPath={walkPath}
          colors={MANIFOLDS.map((m) => m.color)}
          pressure={0.6}
        />
        <div className="absolute bottom-3 left-3 font-mono text-[10px] text-muted-foreground/60 pointer-events-none">
          space = jump · esc = close · · trace  ◆ fielfold  ▣ task  → walk
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
  const [copied, setCopied] = useState(false);
  const label = msg.role === "user" ? "\\user::" : (mode === "mo" ? "\\mo::" : "\\ai::");
  const copyOne = async () => {
    await navigator.clipboard.writeText(`${label}\n${msg.content}`);
    setCopied(true); setTimeout(() => setCopied(false), 1200);
  };
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="group relative max-w-[80%] rounded-lg bg-primary/90 px-4 py-2.5 font-mono text-sm text-primary-foreground">
          <div className="mb-1 font-mono text-[10px] opacity-70">{label}</div>
          <div className="whitespace-pre-wrap">{msg.content}</div>
          <button
            onClick={copyOne}
            className="absolute -top-2 -right-2 rounded border border-primary-foreground/30 bg-background/80 px-1.5 py-0.5 font-mono text-[9px] text-foreground opacity-0 group-hover:opacity-100 hover:border-ridge hover:text-ridge transition"
            title="copy this message with label"
          >{copied ? "✓" : "⧉"}</button>
        </div>
      </div>
    );
  }
  const m = MANIFOLDS.find((x) => x.id === msg.manifold);
  return (
    <div className="group space-y-2">
      <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
        <span className="ridge">{label}</span>
        {m && (
          <>
            <span className="opacity-40">·</span>
            <span style={{ color: m.color }}>{m.sigil} {m.name.toLowerCase()}</span>
          </>
        )}
        <button
          onClick={copyOne}
          className="ml-auto opacity-0 group-hover:opacity-100 hover:text-ridge transition"
          title="copy this message with label"
        >{copied ? "✓ copied" : "⧉ copy"}</button>
        {mode === "ai" && msg.telemetry && (
          <button onClick={() => setShowTelemetry((v) => !v)} className="opacity-60 hover:opacity-100">
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

// ────────────── TaskPanel ──────────────
// life·organizer — cyberpunk-light. Categories are free-text so the AI can
// invent them. Tasks appear as ▣ nodes in the sacred-geometry visualizer.
function TaskPanel({
  tasks, onAdd, onPatch, onDelete,
}: {
  tasks: Task[];
  onAdd: (t: { title: string; category?: string; priority?: number; notes?: string; due_at?: string | null }) => void;
  onPatch: (id: string, patch: Partial<Pick<Task, "title" | "notes" | "category" | "status" | "priority" | "due_at">>) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState(2);
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");

  const categories = useMemo(() => {
    const set = new Set(tasks.map((t) => t.category));
    return Array.from(set);
  }, [tasks]);

  const visible = tasks.filter((t) =>
    filter === "all" ? true : filter === "done" ? t.status === "done" : (t.status === "open" || t.status === "doing")
  );

  const byCat = new Map<string, Task[]>();
  for (const t of visible) {
    if (!byCat.has(t.category)) byCat.set(t.category, []);
    byCat.get(t.category)!.push(t);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-mono text-xs ridge">▣ life·organizer</h2>
            <p className="font-mono text-[10px] text-muted-foreground">day-to-day layer · AI can add·edit·complete</p>
          </div>
          <div className="flex gap-1">
            {(["open", "all", "done"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-2 py-0.5 font-mono text-[10px] rounded ${filter === f ? "bg-ridge/20 text-ridge" : "text-muted-foreground hover:text-foreground"}`}>{f}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-b border-border p-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) { onAdd({ title: title.trim(), category: category.trim() || "inbox", priority }); setTitle(""); }}}
          placeholder="new task — what needs doing?"
          className="w-full rounded border border-border bg-background/60 px-2 py-1 font-mono text-xs focus:outline-none focus:border-ridge"
        />
        <div className="flex gap-2">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="category (or pick →)"
            className="flex-1 rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-ridge"
            list="cat-list"
          />
          <datalist id="cat-list">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
          <select
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-ridge"
          >
            <option value={1}>p1</option>
            <option value={2}>p2</option>
            <option value={3}>p3</option>
          </select>
          <button
            onClick={() => { if (title.trim()) { onAdd({ title: title.trim(), category: category.trim() || "inbox", priority }); setTitle(""); }}}
            className="rounded bg-ridge/80 px-3 py-1 font-mono text-[11px] text-primary-foreground hover:brightness-110"
          >+ add</button>
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {categories.slice(0, 8).map((c) => (
              <button key={c} onClick={() => setCategory(c)} className="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-ridge hover:text-ridge">{c}</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {visible.length === 0 && <p className="p-4 text-center font-mono text-xs text-muted-foreground">no tasks — ask the AI to help you plan something.</p>}
        {Array.from(byCat.entries()).map(([cat, list]) => (
          <div key={cat} className="space-y-1">
            <div className="flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="ridge">▣</span>{cat} <span className="opacity-40">· {list.length}</span>
            </div>
            {list.map((t) => (
              <div key={t.id} className={`group rounded border p-2 ${t.status === "done" ? "border-border/40 bg-background/20 opacity-60" : t.status === "doing" ? "border-ridge/60 bg-ridge/10" : "border-border/60 bg-background/40"}`}>
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => onPatch(t.id, { status: t.status === "done" ? "open" : "done" })}
                    className="mt-0.5 font-mono text-xs ridge"
                    title="toggle done"
                  >{t.status === "done" ? "☑" : t.status === "doing" ? "◐" : "☐"}</button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs ${t.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</span>
                      <span className="font-mono text-[9px] text-muted-foreground/60">p{t.priority}</span>
                      {t.source === "ai" && <span className="font-mono text-[9px] text-ridge/80" title="added by AI">AI</span>}
                    </div>
                    {t.notes && <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/80 whitespace-pre-wrap">{t.notes}</div>}
                    {t.due_at && <div className="mt-0.5 font-mono text-[9px] text-muted-foreground/60">due {t.due_at.slice(0, 10)}</div>}
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
                    {t.status !== "doing" && t.status !== "done" && (
                      <button onClick={() => onPatch(t.id, { status: "doing" })} className="font-mono text-[9px] text-ridge hover:brightness-125" title="mark doing">◐</button>
                    )}
                    <button onClick={() => onDelete(t.id)} className="font-mono text-[10px] text-destructive hover:brightness-125" title="delete">×</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

