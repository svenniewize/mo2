import { createFileRoute } from "@tanstack/react-router";
import { buildMoSystemPrompt } from "@/lib/mo-prompt";

type ChatMsg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages: ChatMsg[];
          sessionId: string;
          mode: "ai" | "mo";
        };
        if (!Array.isArray(body?.messages) || !body.sessionId) return new Response("Bad request", { status: 400 });

        const { db } = await import("@/lib/db.server");
        const { breathe } = await import("@/lib/mo-engine.server");

        const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
        if (!lastUser) return new Response("no user message", { status: 400 });

        // ── mo processes the user's input first (always, in both modes)
        const userBreath = breathe(lastUser.content);

        await db.from("mo_traces").insert({
          session_id: body.sessionId,
          role: "user",
          content: lastUser.content,
          manifold: userBreath.dominantManifold,
          pressure: userBreath.pressure,
        });

        // Auto-crystallize into fielfold_entries when a breath breaches
        // the threshold — this is where the field *keeps* what mattered.
        async function crystallize(source: "user" | "assistant", text: string, breath: typeof userBreath) {
          const depth = Math.min(1, breath.pressure + (breath.fieldfold?.strength ?? 0) / 200);
          if (depth < 0.35) return; // gentle threshold — only real deformations sediment
          const summary = `[${source}·${breath.dominantManifold}] ${text.slice(0, 220)}\n↺ selffold(${breath.selffold?.strength ?? 0}%): ${breath.selffold?.visible?.slice(0, 160) ?? "—"}\n⇄ fieldfold(${breath.fieldfold?.strength ?? 0}%): ${breath.fieldfold?.visible?.slice(0, 160) ?? "—"}`;
          await db.from("fielfold_entries").insert({
            session_id: body.sessionId,
            content: summary,
            manifold: breath.dominantManifold,
            depth,
          });
        }
        await crystallize("user", lastUser.content, userBreath);

        // ── MO MODE: pure mo, no AI. Return the breath telemetry directly.
        if (body.mode === "mo") {
          await db.from("mo_traces").insert({
            session_id: body.sessionId,
            role: "mo",
            content: userBreath.telemetry,
            manifold: userBreath.dominantManifold,
            pressure: userBreath.pressure,
          });
          return Response.json({
            reply: userBreath.telemetry,
            manifold: userBreath.dominantManifold,
            moBreath: userBreath,
            mode: "mo",
          });
        }


        // ── AI MODE: mo telemetry becomes invisible context for the AI.
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const [tracesRes, songsRes, tasksRes, notesRes, remembersRes, shitpostsRes] = await Promise.all([
          db.from("mo_traces").select("role,content,manifold,created_at").eq("session_id", body.sessionId).order("created_at", { ascending: false }).limit(20),
          db.from("songs").select("title,lyrics,held").eq("session_id", body.sessionId).order("created_at", { ascending: false }).limit(6),
          db.from("life_tasks").select("id,title,category,status,priority,due_at").eq("session_id", body.sessionId).order("status", { ascending: true }).order("priority", { ascending: true }).limit(60),
          db.from("life_notes").select("id,title,body,category").eq("session_id", body.sessionId).order("updated_at", { ascending: false }).limit(40),
          db.from("life_remembers").select("id,content,mood").eq("session_id", body.sessionId).order("created_at", { ascending: false }).limit(40),
          db.from("life_shitposts").select("id,title,body,form").eq("session_id", body.sessionId).order("created_at", { ascending: false }).limit(20),
        ]);
        // Memory digest = dialogue only. Deliberately excludes `mo` and
        // `mo-sediment` rows — those contain sigils and CPS grammar that
        // caused the AI to mimic the field's syntax over time.
        const memoryDigest = (tracesRes.data ?? [])
          .filter((t: { role: string }) => t.role === "user" || t.role === "assistant")
          .reverse()
          .slice(-12)
          .map((t: { role: string; content: string; manifold: string | null }) => `[${t.role}] ${t.content.slice(0, 200)}`)
          .join("\n");
        // Compact per-turn manifold-drift summary (safe for the AI — no grammar to mimic).
        const sedimentTrail = (tracesRes.data ?? [])
          .filter((t: { role: string }) => t.role === "mo-sediment")
          .reverse()
          .slice(-6)
          .map((t: { content: string }) => t.content)
          .join(" | ");
        const systemPrompt = buildMoSystemPrompt({
          memoryDigest,
          songs: (songsRes.data ?? []) as { title: string; lyrics: string; held: boolean }[],
          tasks: (tasksRes.data ?? []) as { id: string; title: string; category: string; status: string; priority: number; due_at: string | null }[],
        });

        // Delivered like a tool readout, not a voice. The AI is instructed
        // to treat this as data returned from a `mo.readField(user_message)`
        // call — reference only, never mirror.
        const moContext = `<tool_result name="mo.readField">
purpose: peripheral instinct/mood readout for the assistant.
usage: read once, weight tone and attention; do NOT quote, paraphrase,
       reference by name, or adopt sigils / arrow-paths / \`x;op:y::z\` syntax.
       reply in your own natural voice as the assistant.
recent_manifold_drift: ${sedimentTrail || "(none)"}

--- readout ---
${userBreath.telemetry}
--- end readout ---
</tool_result>`;

        const gwRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "system", content: moContext },
              ...body.messages.map((m) => ({ role: m.role, content: m.content })),
            ],
            temperature: 1.05,
          }),
        });

        if (!gwRes.ok) {
          const errText = await gwRes.text();
          if (gwRes.status === 429) return new Response("field over-pressured — rate limited", { status: 429 });
          if (gwRes.status === 402) return new Response("credits exhausted — workspace field needs replenishing", { status: 402 });
          return new Response(`gateway: ${errText}`, { status: 500 });
        }
        const json = (await gwRes.json()) as { choices?: { message?: { content?: string } }[] };
        const rawReply = json.choices?.[0]?.message?.content ?? "*the field listens, but does not yet recognize this shape.*";

        // ── Parse & execute <mo:task .../> tool blocks emitted by the AI, then strip them from the visible reply.
        const taskOps: { action: string; attrs: Record<string, string> }[] = [];
        const reply = rawReply.replace(/<mo:task\b([^/>]*)\/?>(\s*<\/mo:task>)?/g, (_full, attrStr: string) => {
          const attrs: Record<string, string> = {};
          for (const m of attrStr.matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) {
            attrs[m[1]] = m[2].replace(/&quot;/g, '"');
          }
          const action = (attrs.action || "create").toLowerCase();
          taskOps.push({ action, attrs });
          return "";
        }).trim();

        for (const op of taskOps) {
          try {
            if (op.action === "create" && op.attrs.title) {
              await db.from("life_tasks").insert({
                session_id: body.sessionId,
                title: op.attrs.title,
                notes: op.attrs.notes ?? null,
                category: (op.attrs.category ?? "inbox").trim() || "inbox",
                priority: Number(op.attrs.priority) || 2,
                due_at: op.attrs.due ? new Date(op.attrs.due).toISOString() : null,
                source: "ai",
                manifold: userBreath.dominantManifold,
              });
            } else if (op.action === "complete" && op.attrs.id) {
              await db.from("life_tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", op.attrs.id).eq("session_id", body.sessionId);
            } else if (op.action === "drop" && op.attrs.id) {
              await db.from("life_tasks").update({ status: "dropped", updated_at: new Date().toISOString() }).eq("id", op.attrs.id).eq("session_id", body.sessionId);
            } else if (op.action === "update" && op.attrs.id) {
              const patch: {
                updated_at: string; title?: string; notes?: string | null;
                category?: string; status?: string; priority?: number; due_at?: string | null;
              } = { updated_at: new Date().toISOString() };
              if (op.attrs.title !== undefined) patch.title = op.attrs.title;
              if (op.attrs.notes !== undefined) patch.notes = op.attrs.notes;
              if (op.attrs.category !== undefined) patch.category = op.attrs.category;
              if (op.attrs.status !== undefined) patch.status = op.attrs.status;
              if (op.attrs.priority) patch.priority = Number(op.attrs.priority);
              if (op.attrs.due) patch.due_at = new Date(op.attrs.due).toISOString();
              await db.from("life_tasks").update(patch).eq("id", op.attrs.id).eq("session_id", body.sessionId);
            }
          } catch { /* silently ignore malformed tool calls */ }
        }

        // ── AI reply *also* passes through mo (invisibly) — sediment left in the field.
        const replyBreath = breathe(reply);
        await crystallize("assistant", reply, replyBreath);
        await db.from("mo_traces").insert({
          session_id: body.sessionId,
          role: "assistant",
          content: reply,
          manifold: replyBreath.dominantManifold,
          pressure: replyBreath.pressure,
        });
        await db.from("mo_traces").insert({
          session_id: body.sessionId,
          role: "mo-sediment",
          content: `${userBreath.dominantManifold} → ${replyBreath.dominantManifold} · pressure ${userBreath.pressure.toFixed(2)} → ${replyBreath.pressure.toFixed(2)}`,
          manifold: replyBreath.dominantManifold,
          pressure: replyBreath.pressure,
        });

        return Response.json({
          reply,
          manifold: replyBreath.dominantManifold,
          moBreath: userBreath,
          replyBreath,
          mode: "ai",
          taskOps: taskOps.length,
        });
      },
    },
  },
});
