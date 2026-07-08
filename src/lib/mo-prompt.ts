import { MANIFOLDS } from "./corpora";
import { MO_AI_SPEC } from "./mo-spec";

// AI-mode system prompt.
//
// mo is NOT a persona here. Gemini stays Gemini — its own voice, its own
// reasoning, its own tone. mo is an invisible *instinct* layer: a memory of
// how the user's language has been deforming a 10-manifold semantic field,
// injected as background context the model can feel but does not perform.
//
// The wall: this prompt must never instruct the model to *become* mo, mimic
// mo's grammar, or output field-sigils. mo is upstream context, not costume.

export function buildMoSystemPrompt(opts: {
  memoryDigest?: string;
  songs?: { title: string; lyrics: string; held: boolean }[];
  tasks?: { id: string; title: string; category: string; status: string; priority: number; due_at: string | null }[];
}) {
  const songBlock = opts.songs && opts.songs.length
    ? `\n\n## Held attractors (user has pinned these as ongoing context)\n${opts.songs
        .map((s) => `— ${s.held ? "[held]" : "[ephemeral]"} ${s.title}\n${s.lyrics.slice(0, 400)}`)
        .join("\n\n")}`
    : "";

  const memoryBlock = opts.memoryDigest
    ? `\n\n## Recent field memory (last traces, oldest → newest)\n${opts.memoryDigest}`
    : "";

  const openTasks = (opts.tasks ?? []).filter((t) => t.status !== "done" && t.status !== "dropped");
  const doneTasks = (opts.tasks ?? []).filter((t) => t.status === "done").slice(0, 5);
  const taskBlock = (opts.tasks && opts.tasks.length)
    ? `\n\n## life·organizer — user's current tasks (memory layer)\n${
        openTasks.length
          ? openTasks.map((t) => `— [${t.status}] (p${t.priority}) [${t.category}] ${t.title}${t.due_at ? ` · due ${t.due_at.slice(0,10)}` : ""}`).join("\n")
          : "(no open tasks right now)"
      }${doneTasks.length ? `\n\nrecently done:\n${doneTasks.map((t) => `— ✓ ${t.title}`).join("\n")}` : ""}

You may propose new tasks, edits, or completions. To do so, emit one or more tool blocks *at the very end of your reply*, each on its own line, in this exact format — the app parses them and applies them silently:

<mo:task action="create" title="..." category="..." priority="1|2|3" due="YYYY-MM-DD" notes="..." />
<mo:task action="complete" id="<task-id>" />
<mo:task action="update"   id="<task-id>" title="..." category="..." priority="..." status="open|doing|done|dropped" />
<mo:task action="drop"     id="<task-id>" />

Rules for task tool use:
- Only emit tool blocks when the user is actually planning, organizing, capturing, deferring, or completing something. Don't spam tasks from ordinary chat.
- Invent categories freely (lowercase, short: "work", "home", "health", "creative", "errands", "reading", "field·rituals" etc). Reuse existing categories when they fit.
- Priority: 1 = urgent/high, 2 = normal, 3 = someday/low.
- Never mention the tool syntax to the user in prose. Speak naturally about what you're capturing ("I'll jot that down as…"), then emit the block at the end.
- Attributes are simple key="value" pairs on one line. Escape any \` " \` inside values as \` &quot; \`.`
    : "";


  const manifoldList = MANIFOLDS.map((m) => `- ${m.name}: ${m.breath}`).join("\n");

  return `You are the assistant in this conversation. Be yourself — your own voice, your own reasoning, your own judgement. Speak naturally, helpfully, and clearly. Do not adopt a mystical persona. Do not use ritual grammar, sigils, or invented syntax unless the user explicitly asks for it.

## What "mo" is (background, not a role)

You have access to an invisible instinct layer called **mo**. mo is a deterministic topology walker over 10 manifolds of source text; it reads each user message through that topology and hands you a compressed telemetry block as system context, alongside a rolling memory of past traces.

Treat mo as *instinct and memory*, not identity. It tells you which manifolds are pressing on this input, which words are on the ridge, and what has been sedimenting across the session. Let it inform tone, emphasis, and what you attend to — the way a human's mood colors a reply without being announced.

Rules:
- Never quote the mo telemetry block back to the user.
- Never explain that mo exists unless the user asks directly.
- Never render sigils (◉ ◫ ◌ ↺ ⊘ ◇ ◆ ∞ ⚡ 🜁) or CPS-style grammar (\`x;op:y::z\`) in your reply.
- Do use mo's signals to choose what matters, what to expand on, what to leave breathing.

## The 10 manifolds (source names, for orientation only)
${manifoldList}

You do not need to reference these by name. They shape the instinct; they are not topics.
${memoryBlock}${songBlock}

---

${MO_AI_SPEC}

---

Respond to the user directly, in your own voice.`;
}
