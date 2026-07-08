// life·organizer panel: 4 sub-sections (notes · tasks · remember · shitpost),
// with a "full view" toggle that lets the parent shrink the chat pane.
// Each sub-section fetches/mutates its own /api endpoint. Kept self-contained
// so index.tsx just drops it in.
import { useEffect, useMemo, useState } from "react";

type Note = { id: string; title: string; body: string; category: string; created_at: string; updated_at: string };
type Task = {
  id: string; title: string; notes: string | null; category: string;
  status: "open" | "doing" | "done" | "dropped"; priority: number;
  due_at: string | null; source: string; manifold: string | null;
  created_at: string; updated_at: string;
};
type Remember = { id: string; content: string; mood: string; created_at: string };
type Shitpost = { id: string; title: string; body: string; form: string; created_at: string };

export type LifeTab = "notes" | "tasks" | "remember" | "shitpost";

export function LifePanel({
  sessionId, full, onToggleFull, activeTab, setActiveTab, onTasksChange,
}: {
  sessionId: string;
  full: boolean;
  onToggleFull: () => void;
  activeTab: LifeTab;
  setActiveTab: (t: LifeTab) => void;
  onTasksChange?: (tasks: Task[]) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex gap-1">
          {(["notes", "tasks", "remember", "shitpost"] as LifeTab[]).map((id) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`rounded px-2 py-1 font-mono text-[11px] transition ${
                activeTab === id ? "bg-ridge/20 text-ridge" : "text-muted-foreground hover:text-foreground"
              }`}
            >{tabGlyph(id)} {id}</button>
          ))}
        </div>
        <button
          onClick={onToggleFull}
          className="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-ridge hover:text-ridge transition"
          title={full ? "collapse — chat gets the space back" : "open full view — chat gets narrow"}
        >{full ? "⇥ collapse" : "⇤ open full"}</button>
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === "notes" && <NotesSection sessionId={sessionId} />}
        {activeTab === "tasks" && <TasksSection sessionId={sessionId} onChange={onTasksChange} />}
        {activeTab === "remember" && <RememberSection sessionId={sessionId} />}
        {activeTab === "shitpost" && <ShitpostSection sessionId={sessionId} />}
      </div>
    </div>
  );
}

function tabGlyph(id: LifeTab) {
  return id === "notes" ? "✎" : id === "tasks" ? "▣" : id === "remember" ? "◈" : "☙";
}

// ────────────── notes ──────────────
function NotesSection({ sessionId }: { sessionId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  const refresh = async () => {
    const r = await fetch(`/api/notes?session_id=${sessionId}`);
    const j = await r.json();
    setNotes(j.notes ?? []);
  };
  useEffect(() => { if (sessionId) refresh(); }, [sessionId]);

  const categories = useMemo(() => Array.from(new Set(notes.map((n) => n.category))), [notes]);
  const visible = filter ? notes.filter((n) => n.category === filter) : notes;
  const byCat = new Map<string, Note[]>();
  for (const n of visible) {
    if (!byCat.has(n.category)) byCat.set(n.category, []);
    byCat.get(n.category)!.push(n);
  }

  const add = async () => {
    if (!title.trim()) return;
    await fetch("/api/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, title: title.trim(), body: body.trim(), category: category.trim() || "inbox" }),
    });
    setTitle(""); setBody(""); setCategory(""); refresh();
  };
  const del = async (id: string) => {
    await fetch("/api/notes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3 space-y-2">
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="note title"
          className="w-full rounded border border-border bg-background/60 px-2 py-1 font-mono text-xs focus:outline-none focus:border-ridge"
        />
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="body (optional)…"
          rows={3}
          className="w-full resize-none rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-ridge"
        />
        <div className="flex gap-2">
          <input
            value={category} onChange={(e) => setCategory(e.target.value)}
            placeholder="category (or pick →)"
            list="notes-cat-list"
            className="flex-1 rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-ridge"
          />
          <datalist id="notes-cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <button onClick={add} className="rounded bg-ridge/80 px-3 py-1 font-mono text-[11px] text-primary-foreground hover:brightness-110">+ jot</button>
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            <button onClick={() => setFilter("")} className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${filter === "" ? "border-ridge text-ridge" : "border-border/60 text-muted-foreground"}`}>all</button>
            {categories.map((c) => (
              <button key={c} onClick={() => setFilter(c === filter ? "" : c)} className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${filter === c ? "border-ridge text-ridge" : "border-border/60 text-muted-foreground hover:border-ridge hover:text-ridge"}`}>{c}</button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {visible.length === 0 && <p className="p-4 text-center font-mono text-xs text-muted-foreground">no notes yet — jot something down.</p>}
        {Array.from(byCat.entries()).map(([cat, list]) => (
          <div key={cat} className="space-y-1">
            <div className="flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="ridge">✎</span>{cat} <span className="opacity-40">· {list.length}</span>
            </div>
            {list.map((n) => (
              <div key={n.id} className="group rounded border border-border/60 bg-background/40 p-2">
                <div className="flex items-center justify-between">
                  {editing === n.id ? (
                    <input
                      defaultValue={n.title}
                      onBlur={async (e) => {
                        await fetch("/api/notes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id, title: e.target.value }) });
                        setEditing(null); refresh();
                      }}
                      autoFocus
                      className="flex-1 rounded border border-ridge bg-background px-1 py-0.5 font-mono text-xs"
                    />
                  ) : (
                    <button onClick={() => setEditing(n.id)} className="text-left font-mono text-xs text-foreground hover:text-ridge">{n.title}</button>
                  )}
                  <button onClick={() => del(n.id)} className="opacity-0 group-hover:opacity-100 font-mono text-[10px] text-destructive">×</button>
                </div>
                {n.body && <div className="mt-1 whitespace-pre-wrap font-mono text-[10px] text-muted-foreground/90">{n.body}</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────── tasks ──────────────
function TasksSection({ sessionId, onChange }: { sessionId: string; onChange?: (tasks: Task[]) => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState(2);
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");

  const refresh = async () => {
    const r = await fetch(`/api/tasks?session_id=${sessionId}`);
    const j = await r.json();
    setTasks(j.tasks ?? []);
    onChange?.(j.tasks ?? []);
  };
  useEffect(() => { if (sessionId) refresh(); }, [sessionId]);

  const categories = useMemo(() => Array.from(new Set(tasks.map((t) => t.category))), [tasks]);
  const visible = tasks.filter((t) =>
    filter === "all" ? true : filter === "done" ? t.status === "done" : (t.status === "open" || t.status === "doing")
  );
  const byCat = new Map<string, Task[]>();
  for (const t of visible) {
    if (!byCat.has(t.category)) byCat.set(t.category, []);
    byCat.get(t.category)!.push(t);
  }

  const add = async () => {
    if (!title.trim()) return;
    await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, title: title.trim(), category: category.trim() || "inbox", priority }) });
    setTitle(""); refresh();
  };
  const patch = async (id: string, p: Partial<Task>) => {
    await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...p }) });
    refresh();
  };
  const del = async (id: string) => {
    await fetch("/api/tasks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2 flex items-center justify-between">
        <p className="font-mono text-[10px] text-muted-foreground">day-to-day · AI can add·edit·complete</p>
        <div className="flex gap-1">
          {(["open", "all", "done"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-2 py-0.5 font-mono text-[10px] rounded ${filter === f ? "bg-ridge/20 text-ridge" : "text-muted-foreground hover:text-foreground"}`}>{f}</button>
          ))}
        </div>
      </div>
      <div className="border-b border-border p-3 space-y-2">
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) add(); }}
          placeholder="new task — what needs doing?"
          className="w-full rounded border border-border bg-background/60 px-2 py-1 font-mono text-xs focus:outline-none focus:border-ridge"
        />
        <div className="flex gap-2">
          <input
            value={category} onChange={(e) => setCategory(e.target.value)}
            placeholder="category" list="tasks-cat-list"
            className="flex-1 rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-ridge"
          />
          <datalist id="tasks-cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-ridge">
            <option value={1}>p1</option><option value={2}>p2</option><option value={3}>p3</option>
          </select>
          <button onClick={add} className="rounded bg-ridge/80 px-3 py-1 font-mono text-[11px] text-primary-foreground hover:brightness-110">+ add</button>
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
                  <button onClick={() => patch(t.id, { status: t.status === "done" ? "open" : "done" })} className="mt-0.5 font-mono text-xs ridge" title="toggle done">
                    {t.status === "done" ? "☑" : t.status === "doing" ? "◐" : "☐"}
                  </button>
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
                      <button onClick={() => patch(t.id, { status: "doing" })} className="font-mono text-[9px] text-ridge hover:brightness-125" title="mark doing">◐</button>
                    )}
                    <button onClick={() => del(t.id)} className="font-mono text-[10px] text-destructive hover:brightness-125" title="delete">×</button>
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

// ────────────── remember ──────────────
// mood::  not category — memories are felt, not filed.
const MOODS = ["neutral", "warm", "aching", "electric", "tender", "wry", "haunted", "bright", "hollow", "still"];

function RememberSection({ sessionId }: { sessionId: string }) {
  const [items, setItems] = useState<Remember[]>([]);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("warm");
  const [filter, setFilter] = useState<string>("");

  const refresh = async () => {
    const r = await fetch(`/api/remembers?session_id=${sessionId}`);
    const j = await r.json();
    setItems(j.remembers ?? []);
  };
  useEffect(() => { if (sessionId) refresh(); }, [sessionId]);

  const moods = useMemo(() => Array.from(new Set([...items.map((i) => i.mood), ...MOODS])), [items]);
  const visible = filter ? items.filter((i) => i.mood === filter) : items;

  const add = async () => {
    if (!content.trim()) return;
    await fetch("/api/remembers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, content: content.trim(), mood }) });
    setContent(""); refresh();
  };
  const del = async (id: string) => {
    await fetch("/api/remembers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3 space-y-2">
        <textarea
          value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="something to remember…"
          rows={2}
          className="w-full resize-none rounded border border-border bg-background/60 px-2 py-1 font-mono text-xs focus:outline-none focus:border-ridge"
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">mood::</span>
          <select value={mood} onChange={(e) => setMood(e.target.value)} className="flex-1 rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-ridge">
            {moods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={add} className="rounded bg-ridge/80 px-3 py-1 font-mono text-[11px] text-primary-foreground hover:brightness-110">◈ keep</button>
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          <button onClick={() => setFilter("")} className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${filter === "" ? "border-ridge text-ridge" : "border-border/60 text-muted-foreground"}`}>all</button>
          {Array.from(new Set(items.map((i) => i.mood))).map((m) => (
            <button key={m} onClick={() => setFilter(m === filter ? "" : m)} className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${filter === m ? "border-ridge text-ridge" : "border-border/60 text-muted-foreground hover:border-ridge hover:text-ridge"}`}>{m}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {visible.length === 0 && <p className="p-4 text-center font-mono text-xs text-muted-foreground">no memories held yet.</p>}
        {visible.map((r) => (
          <div key={r.id} className="group rounded border border-ridge/30 bg-ridge/5 p-2">
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] ridge">
              <span>◈ mood:: <span className="opacity-80">{r.mood}</span></span>
              <div className="flex gap-2 items-center">
                <span className="opacity-40 text-muted-foreground">{r.created_at.slice(0, 10)}</span>
                <button onClick={() => del(r.id)} className="opacity-0 group-hover:opacity-100 text-destructive">×</button>
              </div>
            </div>
            <div className="whitespace-pre-wrap font-mono text-[11px] text-foreground/90">{r.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────── shitpost / poetry corner ──────────────
type PoetryForm = {
  id: string; label: string; glyph: string; blurb: string;
  steps: string[];
  scaffold: string;
};

const POETRY_FORMS: PoetryForm[] = [
  {
    id: "haiku", label: "haiku", glyph: "🌱",
    blurb: "three lines · 5·7·5 syllables · a season · a cut (kireji)",
    steps: [
      "pick one small vivid thing you can see or feel right now",
      "line 1 (5) — set the scene, no adjectives if you can help it",
      "line 2 (7) — a shift · time moves, or a second image lands",
      "line 3 (5) — the cut · a turn, a surprise, a silence",
    ],
    scaffold: "still pond in june\nan old frog leans off the stone\n— the splash was blue",
  },
  {
    id: "cinquain", label: "cinquain", glyph: "❋",
    blurb: "five lines · 2·4·6·8·2 syllables · builds then collapses",
    steps: [
      "line 1 (2) — a single noun · the subject",
      "line 2 (4) — two adjectives about it",
      "line 3 (6) — three -ing verbs it does",
      "line 4 (8) — a short phrase, a feeling",
      "line 5 (2) — a synonym or twist for line 1",
    ],
    scaffold: "moths\nsoft, unwelcome\ndrifting, bumping, staying\nthe lamp does not know their names\nghosts",
  },
  {
    id: "freeverse", label: "free verse", glyph: "≈",
    blurb: "no meter, no rhyme · line breaks *are* the punctuation",
    steps: [
      "write one long sentence about what you can't stop thinking about",
      "break the line every time your breath would break",
      "delete every third adjective",
      "put the strongest image last",
    ],
    scaffold: "and then i saw\nnot the thing itself\nbut the shape it left\nin the light between us",
  },
  {
    id: "acrostic", label: "acrostic", glyph: "⇓",
    blurb: "the first letter of each line spells a hidden word",
    steps: [
      "pick a word · 4–8 letters · something charged",
      "write it vertically down the left",
      "make each line start with its letter and lean toward the word's feeling",
      "don't force the last line — let it land wherever the word does",
    ],
    scaffold: "S oft as a broken radio\nT rying to reach a place\nA nywhere but here — and\nY et, the frequency holds",
  },
  {
    id: "found", label: "found poem", glyph: "◇",
    blurb: "steal · rearrange · attribute nothing",
    steps: [
      "grab any text — a receipt, a text thread, a wikipedia paragraph",
      "circle 12 words that ring",
      "throw the rest away",
      "arrange the survivors · you may change nothing but their order",
    ],
    scaffold: "milk · almond · one\ntotal · thank you\ncome again\nplease",
  },
  {
    id: "erasure", label: "erasure", glyph: "▨",
    blurb: "take an existing paragraph and *erase* words until only a poem remains",
    steps: [
      "paste 4–6 sentences of prose · anything",
      "black out everything that isn't the poem hiding inside",
      "leave the surviving words in their original spots",
    ],
    scaffold: "the ___ was ___. we ___ under ___,\n___ waiting for ___ to be\nsomething ___ enough to ___",
  },
  {
    id: "list", label: "list poem", glyph: "☰",
    blurb: "just a list · but the *order* is the poem",
    steps: [
      "pick a container: 'things i saw on the way home', 'lies that helped'",
      "list 7–12 items · concrete, specific, weird",
      "the last item does the heavy lifting · save your best for it",
    ],
    scaffold: "things i did not throw away:\nthe ticket\nthe expired lozenge\nthe shape of your name in my mouth",
  },
  {
    id: "shitpost", label: "pure shitpost", glyph: "☙",
    blurb: "no rules · deliberately bad · a small offering to chaos",
    steps: [
      "write the worst first line you can think of",
      "rhyme something with itself",
      "end mid-",
    ],
    scaffold: "roses are red\nviolets are also red (i'm colorblind)\nanyway. bees.",
  },
];

function ShitpostSection({ sessionId }: { sessionId: string }) {
  const [items, setItems] = useState<Shitpost[]>([]);
  const [form, setForm] = useState<PoetryForm>(POETRY_FORMS[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const refresh = async () => {
    const r = await fetch(`/api/shitposts?session_id=${sessionId}`);
    const j = await r.json();
    setItems(j.shitposts ?? []);
  };
  useEffect(() => { if (sessionId) refresh(); }, [sessionId]);

  const add = async () => {
    if (!body.trim()) return;
    await fetch("/api/shitposts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, title: title.trim(), body, form: form.id }) });
    setTitle(""); setBody(""); refresh();
  };
  const del = async (id: string) => {
    await fetch("/api/shitposts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    refresh();
  };
  const useScaffold = () => setBody(form.scaffold);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          {POETRY_FORMS.map((f) => (
            <button
              key={f.id}
              onClick={() => setForm(f)}
              className={`rounded border px-2 py-0.5 font-mono text-[10px] ${form.id === f.id ? "border-ridge bg-ridge/10 text-ridge" : "border-border/60 text-muted-foreground hover:border-ridge hover:text-ridge"}`}
            >{f.glyph} {f.label}</button>
          ))}
        </div>
        <div className="rounded border border-ridge/30 bg-ridge/5 p-2 space-y-1">
          <div className="font-mono text-[11px] ridge">☙ {form.label} <span className="opacity-60 text-muted-foreground">· {form.blurb}</span></div>
          <ol className="pl-4 space-y-0.5 font-mono text-[10px] text-muted-foreground/90 list-decimal">
            {form.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <button onClick={useScaffold} className="mt-1 rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-ridge hover:text-ridge">↺ use scaffold</button>
        </div>
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="title (optional)"
          className="w-full rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-ridge"
        />
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="write your poem…"
          rows={5}
          className="w-full resize-none rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] leading-relaxed focus:outline-none focus:border-ridge"
        />
        <button onClick={add} className="w-full rounded bg-accent/80 px-3 py-1.5 font-mono text-xs text-accent-foreground hover:brightness-110">☙ publish to the corner</button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {items.length === 0 && <p className="p-4 text-center font-mono text-xs text-muted-foreground">the corner is quiet · make it loud.</p>}
        {items.map((p) => {
          const f = POETRY_FORMS.find((x) => x.id === p.form);
          return (
            <div key={p.id} className="group rounded border border-border/60 bg-background/40 p-2">
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>{f?.glyph ?? "☙"} {p.form}{p.title && <span className="ml-1 ridge">· {p.title}</span>}</span>
                <div className="flex gap-2 items-center">
                  <span className="opacity-40">{p.created_at.slice(0, 10)}</span>
                  <button onClick={() => del(p.id)} className="opacity-0 group-hover:opacity-100 text-destructive">×</button>
                </div>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] text-foreground/90 leading-relaxed">{p.body}</pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
