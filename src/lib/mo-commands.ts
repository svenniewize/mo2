// mo·commands — shared parser & executor for BOTH:
//   1) XML-style tool blocks emitted by the AI:      <mo:task action="create" title="..." />
//   2) shorthand emitted by the USER (or the AI):    me;to:note:: title;body;category
//
// Both surfaces resolve to the same Op[] and run through the same executor.
// That means anything the user can write, the AI can write too — and vice
// versa. The mo substrate executes either.
//
// Shorthand grammar (loose, forgiving — order matches the sections below):
//   me;to:task::       title ; category ; priority(1|2|3) ; due(YYYY-MM-DD) ; notes
//   me;to:task:done::  <task-id>
//   me;to:task:drop::  <task-id>
//   me;to:note::       title ; body ; category
//   me;to:note:del::   <note-id>
//   me;to:remember::   content ; mood
//   me;to:remember:del:: <remember-id>
//   me;to:shitpost::   title ; body ; form
//   me;to:shitpost:del:: <shitpost-id>
//   me;to:read::       any text you want the field to read
//
// The `me;to:` prefix is the user's voice speaking TO mo. Aliases accepted:
//   `mo;to:` · `mo;add:` · `to:mo:`  — all resolve identically.

export type MoOp =
  | { kind: "task"; action: "create"; title: string; category?: string; priority?: number; due?: string; notes?: string }
  | { kind: "task"; action: "complete" | "drop"; id: string }
  | { kind: "task"; action: "update"; id: string; title?: string; category?: string; priority?: number; status?: string; due?: string; notes?: string }
  | { kind: "note"; action: "create"; title: string; body?: string; category?: string }
  | { kind: "note"; action: "update"; id: string; title?: string; body?: string; category?: string }
  | { kind: "note"; action: "delete"; id: string }
  | { kind: "remember"; action: "create"; content: string; mood?: string }
  | { kind: "remember"; action: "delete"; id: string }
  | { kind: "shitpost"; action: "create"; body: string; title?: string; form?: string }
  | { kind: "shitpost"; action: "delete"; id: string }
  | { kind: "read"; text: string };

const PREFIX_RE = /(?:^|\n|\s)(?:me|mo|to);(?:to|add):([a-z]+)(?::([a-z]+))?::\s*([^\n]+)/gi;
// Also accept `to:mo:` style
const PREFIX_RE_ALT = /(?:^|\n|\s)to:mo:([a-z]+)(?::([a-z]+))?::\s*([^\n]+)/gi;

function splitFields(body: string): string[] {
  return body.split(";").map((s) => s.trim());
}

/**
 * Parse shorthand commands out of a free-text string.
 * Returns { ops, stripped } — the ops found + the same text with the command
 * lines removed (so the visible message doesn't repeat the raw command).
 */
export function parseShorthand(text: string): { ops: MoOp[]; stripped: string } {
  const ops: MoOp[] = [];
  const seen: Array<[number, number]> = [];

  const scan = (re: RegExp) => {
    for (const m of text.matchAll(re)) {
      const kind = (m[1] || "").toLowerCase();
      const sub = (m[2] || "").toLowerCase();
      const rest = (m[3] || "").trim();
      if (!rest) continue;
      const op = buildOp(kind, sub, rest);
      if (op) {
        ops.push(op);
        const start = m.index ?? 0;
        seen.push([start, start + m[0].length]);
      }
    }
  };
  scan(PREFIX_RE);
  scan(PREFIX_RE_ALT);

  // Strip matched spans from the visible text
  if (!seen.length) return { ops, stripped: text };
  seen.sort((a, b) => a[0] - b[0]);
  let out = "";
  let cursor = 0;
  for (const [s, e] of seen) {
    if (s < cursor) continue;
    out += text.slice(cursor, s);
    cursor = e;
  }
  out += text.slice(cursor);
  return { ops, stripped: out.replace(/\n{3,}/g, "\n\n").trim() };
}

function buildOp(kind: string, sub: string, rest: string): MoOp | null {
  const parts = splitFields(rest);
  switch (kind) {
    case "task": {
      if (sub === "done" || sub === "complete") return { kind: "task", action: "complete", id: parts[0] };
      if (sub === "drop") return { kind: "task", action: "drop", id: parts[0] };
      if (sub === "update" && parts[0]) return { kind: "task", action: "update", id: parts[0], title: parts[1], category: parts[2], priority: parts[3] ? Number(parts[3]) : undefined };
      const [title, category, priority, due, notes] = parts;
      if (!title) return null;
      return { kind: "task", action: "create", title, category: category || undefined, priority: priority ? Number(priority) : undefined, due: due || undefined, notes: notes || undefined };
    }
    case "note": {
      if (sub === "del" || sub === "delete") return { kind: "note", action: "delete", id: parts[0] };
      if (sub === "update" && parts[0]) return { kind: "note", action: "update", id: parts[0], title: parts[1], body: parts[2], category: parts[3] };
      const [title, body, category] = parts;
      if (!title) return null;
      return { kind: "note", action: "create", title, body: body || "", category: category || undefined };
    }
    case "remember":
    case "memory": {
      if (sub === "del" || sub === "delete") return { kind: "remember", action: "delete", id: parts[0] };
      const [content, mood] = parts;
      if (!content) return null;
      return { kind: "remember", action: "create", content, mood: mood || undefined };
    }
    case "shitpost":
    case "poem":
    case "poetry": {
      if (sub === "del" || sub === "delete") return { kind: "shitpost", action: "delete", id: parts[0] };
      const [title, body, form] = parts;
      if (!body && !title) return null;
      return { kind: "shitpost", action: "create", title: body ? title : "", body: body || title, form: form || undefined };
    }
    case "read": {
      return { kind: "read", text: rest };
    }
  }
  return null;
}

/**
 * Parse XML-style mo tool blocks and return ops + text with those blocks stripped.
 * mo:read is REPLACED inline with a compact readout by the caller.
 */
export function parseXmlBlocks(text: string): { ops: MoOp[]; stripped: string; readSpans: { text: string; marker: string }[] } {

  const ops: MoOp[] = [];
  const readSpans: { text: string; marker: string }[] = [];

  let processed = text.replace(/<mo:read\b([^/>]*)\/?>(\s*<\/mo:read>)?/g, (_full, attrStr: string) => {
    const attrs = parseAttrs(attrStr);
    const t = attrs.text || "";
    if (!t.trim()) return "";
    const marker = `__MO_READ_${readSpans.length}__`;
    readSpans.push({ text: t, marker });
    return marker;
  });

  const stripKind = (kind: "task" | "note" | "remember" | "shitpost") => {
    const re = new RegExp(`<mo:${kind}\\b([^/>]*)\\/?>(\\s*<\\/mo:${kind}>)?`, "g");
    processed = processed.replace(re, (_full, attrStr: string) => {
      const attrs = parseAttrs(attrStr);
      const action = (attrs.action || "create").toLowerCase();
      const op = xmlToOp(kind, action, attrs);
      if (op) ops.push(op);
      return "";
    });
  };
  stripKind("task"); stripKind("note"); stripKind("remember"); stripKind("shitpost");

  return { ops, stripped: processed, readSpans };
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2].replace(/&quot;/g, '"');
  return out;
}

function xmlToOp(kind: string, action: string, a: Record<string, string>): MoOp | null {
  if (kind === "task") {
    if (action === "create" && a.title) return { kind: "task", action: "create", title: a.title, category: a.category, priority: a.priority ? Number(a.priority) : undefined, due: a.due, notes: a.notes };
    if (action === "complete" && a.id) return { kind: "task", action: "complete", id: a.id };
    if (action === "drop" && a.id) return { kind: "task", action: "drop", id: a.id };
    if (action === "update" && a.id) return { kind: "task", action: "update", id: a.id, title: a.title, category: a.category, priority: a.priority ? Number(a.priority) : undefined, status: a.status, due: a.due, notes: a.notes };
  }
  if (kind === "note") {
    if (action === "create" && a.title) return { kind: "note", action: "create", title: a.title, body: a.body, category: a.category };
    if (action === "update" && a.id) return { kind: "note", action: "update", id: a.id, title: a.title, body: a.body, category: a.category };
    if (action === "delete" && a.id) return { kind: "note", action: "delete", id: a.id };
  }
  if (kind === "remember") {
    if (action === "create" && a.content) return { kind: "remember", action: "create", content: a.content, mood: a.mood };
    if (action === "delete" && a.id) return { kind: "remember", action: "delete", id: a.id };
  }
  if (kind === "shitpost") {
    if (action === "create" && a.body) return { kind: "shitpost", action: "create", body: a.body, title: a.title, form: a.form };
    if (action === "delete" && a.id) return { kind: "shitpost", action: "delete", id: a.id };
  }
  return null;
}

/** Execute a list of ops against the DB for a given session. */
export async function executeOps(
  ops: MoOp[],
  ctx: { sessionId: string; manifold?: string | null; source?: "user" | "ai" | "mo" },
): Promise<number> {
  if (!ops.length) return 0;
  const { db } = await import("./db.server");
  const now = () => new Date().toISOString();
  let n = 0;
  for (const op of ops) {
    try {
      if (op.kind === "task") {
        if (op.action === "create") {
          await db.from("life_tasks").insert({
            session_id: ctx.sessionId, title: op.title,
            notes: op.notes ?? null,
            category: (op.category ?? "inbox").trim() || "inbox",
            priority: op.priority ?? 2,
            due_at: op.due ? new Date(op.due).toISOString() : null,
            source: ctx.source ?? "user", manifold: ctx.manifold ?? null,
          });
        } else if (op.action === "complete") {
          await db.from("life_tasks").update({ status: "done", updated_at: now() }).eq("id", op.id).eq("session_id", ctx.sessionId);
        } else if (op.action === "drop") {
          await db.from("life_tasks").update({ status: "dropped", updated_at: now() }).eq("id", op.id).eq("session_id", ctx.sessionId);
        } else if (op.action === "update") {
          const patch: { updated_at: string; title?: string; notes?: string | null; category?: string; status?: string; priority?: number; due_at?: string } = { updated_at: now() };
          if (op.title !== undefined) patch.title = op.title;
          if (op.notes !== undefined) patch.notes = op.notes;
          if (op.category !== undefined) patch.category = op.category;
          if (op.status !== undefined) patch.status = op.status;
          if (op.priority !== undefined) patch.priority = op.priority;
          if (op.due) patch.due_at = new Date(op.due).toISOString();
          await db.from("life_tasks").update(patch).eq("id", op.id).eq("session_id", ctx.sessionId);
        }
      } else if (op.kind === "note") {
        if (op.action === "create") {
          await db.from("life_notes").insert({
            session_id: ctx.sessionId, title: op.title, body: op.body ?? "",
            category: (op.category ?? "inbox").trim() || "inbox",
            source: ctx.source ?? "user", manifold: ctx.manifold ?? null,
          });
        } else if (op.action === "update") {
          const patch: { updated_at: string; title?: string; body?: string; category?: string } = { updated_at: now() };
          if (op.title !== undefined) patch.title = op.title;
          if (op.body !== undefined) patch.body = op.body;
          if (op.category !== undefined) patch.category = op.category;
          await db.from("life_notes").update(patch).eq("id", op.id).eq("session_id", ctx.sessionId);
        } else if (op.action === "delete") {
          await db.from("life_notes").delete().eq("id", op.id).eq("session_id", ctx.sessionId);
        }
      } else if (op.kind === "remember") {
        if (op.action === "create") {
          await db.from("life_remembers").insert({
            session_id: ctx.sessionId, content: op.content,
            mood: (op.mood ?? "neutral").trim() || "neutral",
            source: ctx.source ?? "user", manifold: ctx.manifold ?? null,
          });
        } else {
          await db.from("life_remembers").delete().eq("id", op.id).eq("session_id", ctx.sessionId);
        }
      } else if (op.kind === "shitpost") {
        if (op.action === "create") {
          await db.from("life_shitposts").insert({
            session_id: ctx.sessionId, title: op.title ?? "", body: op.body,
            form: (op.form ?? "freeverse").trim() || "freeverse",
          });
        } else {
          await db.from("life_shitposts").delete().eq("id", op.id).eq("session_id", ctx.sessionId);
        }
      }
      n++;
    } catch { /* ignore malformed */ }
  }
  return n;
}

/** The prime session id — tricksterkekeke unlocks the totality of mo. */
export const PRIME_SESSION = "shared:trickster";
export function isPrime(sessionId: string): boolean { return sessionId === PRIME_SESSION; }
export function isShared(sessionId: string): boolean { return sessionId.startsWith("shared:"); }
