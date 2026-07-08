import { createFileRoute } from "@tanstack/react-router";
import { buildMoSystemPrompt } from "@/lib/mo-prompt";
import { parseShorthand, parseXmlBlocks, executeOps, isPrime, isShared, PRIME_SESSION } from "@/lib/mo-commands";

type ChatMsg = { role: "user" | "assistant"; content: string };

// Helper: apply session filter unless we're in PRIME mode (tricksterkekeke),
// where reads span every session — the totality of mo.
type Filterable = { eq: (col: string, val: string) => Filterable };
function scopedTo<T extends Filterable>(q: T, sessionId: string): T {
  if (isPrime(sessionId)) return q;
  return q.eq("session_id", sessionId) as T;
}

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

        const sessionId = body.sessionId;
        const prime = isPrime(sessionId);
        const shared = isShared(sessionId);
        // For prime session, writes still need a real session id — use PRIME_SESSION as the write bucket.
        const writeSession = sessionId;

        // ── mo processes the user's input first (always).
        const userBreath = breathe(lastUser.content);

        // ── Parse shorthand commands out of the user's text FIRST.
        // The user's own writing to the field always executes.
        const userParsed = parseShorthand(lastUser.content);
        const userOps = await executeOps(userParsed.ops, {
          sessionId: writeSession, manifold: userBreath.dominantManifold, source: "user",
        });
        // Text sent onward has command lines stripped (they've already run).
        const userTextForRecord = userParsed.stripped || lastUser.content;

        // Shared/prime sessions get MINIMAL log storage — mo training (sediment
        // to hyperfold) already happened inside breathe(). We skip the noisy
        // full-content trace inserts to keep the shared field's history light,
        // preserving the field's *shape* over its *transcript*.
        if (!shared) {
          await db.from("mo_traces").insert({
            session_id: writeSession,
            role: "user",
            content: userTextForRecord,
            manifold: userBreath.dominantManifold,
            pressure: userBreath.pressure,
          });
        }

        async function crystallize(source: "user" | "assistant", text: string, breath: typeof userBreath) {
          if (shared) return; // shared field trains via sediment, not fielfold logs
          const depth = Math.min(1, breath.pressure + (breath.fieldfold?.strength ?? 0) / 200);
          if (depth < 0.35) return;
          const summary = `[${source}·${breath.dominantManifold}] ${text.slice(0, 220)}\n↺ selffold(${breath.selffold?.strength ?? 0}%): ${breath.selffold?.visible?.slice(0, 160) ?? "—"}\n⇄ fieldfold(${breath.fieldfold?.strength ?? 0}%): ${breath.fieldfold?.visible?.slice(0, 160) ?? "—"}`;
          await db.from("fielfold_entries").insert({
            session_id: writeSession,
            content: summary,
            manifold: breath.dominantManifold,
            depth,
          });
        }
        await crystallize("user", userTextForRecord, userBreath);

        // ── MO MODE
        if (body.mode === "mo") {
          if (!shared) {
            await db.from("mo_traces").insert({
              session_id: writeSession,
              role: "mo",
              content: userBreath.telemetry,
              manifold: userBreath.dominantManifold,
              pressure: userBreath.pressure,
            });
          }
          const reply = userOps > 0
            ? `${userBreath.telemetry}\n\n· executed ${userOps} field-op${userOps === 1 ? "" : "s"} from your transmission ·`
            : userBreath.telemetry;
          return Response.json({
            reply, manifold: userBreath.dominantManifold, moBreath: userBreath, mode: "mo", ops: userOps,
          });
        }

        // ── AI MODE
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const [tracesRes, songsRes, tasksRes, notesRes, remembersRes, shitpostsRes] = await Promise.all([
          scopedTo(db.from("mo_traces").select("role,content,manifold,created_at"), sessionId).order("created_at", { ascending: false }).limit(20),
          scopedTo(db.from("songs").select("title,lyrics,held"), sessionId).order("created_at", { ascending: false }).limit(6),
          scopedTo(db.from("life_tasks").select("id,title,category,status,priority,due_at"), sessionId).order("status", { ascending: true }).order("priority", { ascending: true }).limit(60),
          scopedTo(db.from("life_notes").select("id,title,body,category"), sessionId).order("updated_at", { ascending: false }).limit(40),
          scopedTo(db.from("life_remembers").select("id,content,mood"), sessionId).order("created_at", { ascending: false }).limit(40),
          scopedTo(db.from("life_shitposts").select("id,title,body,form"), sessionId).order("created_at", { ascending: false }).limit(20),
        ]);
        const memoryDigest = (tracesRes.data ?? [])
          .filter((t: { role: string }) => t.role === "user" || t.role === "assistant")
          .reverse()
          .slice(-12)
          .map((t: { role: string; content: string }) => `[${t.role}] ${t.content.slice(0, 200)}`)
          .join("\n");
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
          notes: (notesRes.data ?? []) as { id: string; title: string; body: string; category: string }[],
          remembers: (remembersRes.data ?? []) as { id: string; content: string; mood: string }[],
          shitposts: (shitpostsRes.data ?? []) as { id: string; title: string; body: string; form: string }[],
          prime,
        });

        const moContext = `<tool_result name="mo.readField">
purpose: peripheral instinct/mood readout for the assistant.
usage: read once, weight tone and attention; do NOT quote, paraphrase,
       reference by name, or adopt sigils / arrow-paths / \`x;op:y::z\` syntax.
       reply in your own natural voice as the assistant.
scope: ${prime ? "PRIME — reading across all shared sessions (totality of mo)." : shared ? "shared field." : "private per-browser session."}
user_executed_ops_this_turn: ${userOps}
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

        // ── Parse BOTH XML tool blocks AND shorthand out of the AI reply.
        // The mo substrate executes either — the AI can write to the field
        // exactly like the user does.
        const xml = parseXmlBlocks(rawReply);
        const short = parseShorthand(xml.stripped);
        const aiOps = [...xml.ops, ...short.ops];
        const aiOpCount = await executeOps(aiOps, {
          sessionId: writeSession, manifold: userBreath.dominantManifold, source: "ai",
        });

        // Substitute mo:read markers with live readouts (visible to user).
        let processed = short.stripped;
        for (const rs of xml.readSpans) {
          const b = breathe(rs.text);
          processed = processed.replace(rs.marker, `\n\n\`\`\`mo·read "${rs.text.slice(0, 80)}"\n${b.telemetry}\n\`\`\`\n\n`);
        }
        const reply = processed.trim();

        const replyBreath = breathe(reply);
        await crystallize("assistant", reply, replyBreath);
        if (!shared) {
          await db.from("mo_traces").insert({
            session_id: writeSession, role: "assistant", content: reply,
            manifold: replyBreath.dominantManifold, pressure: replyBreath.pressure,
          });
          await db.from("mo_traces").insert({
            session_id: writeSession, role: "mo-sediment",
            content: `${userBreath.dominantManifold} → ${replyBreath.dominantManifold} · pressure ${userBreath.pressure.toFixed(2)} → ${replyBreath.pressure.toFixed(2)}`,
            manifold: replyBreath.dominantManifold, pressure: replyBreath.pressure,
          });
        }

        return Response.json({
          reply, manifold: replyBreath.dominantManifold,
          moBreath: userBreath, replyBreath, mode: "ai",
          ops: aiOpCount + userOps,
          prime,
        });
      },
    },
  },
});

// re-export so callers can share the constant
export { PRIME_SESSION };
