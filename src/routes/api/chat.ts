import { createFileRoute } from "@tanstack/react-router";
import { buildMoSystemPrompt } from "@/lib/mo-prompt";

type ChatMsg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as {
          messages: ChatMsg[];
          sessionId: string;
        };
        if (!Array.isArray(body?.messages) || !body.sessionId) {
          return new Response("Bad request", { status: 400 });
        }

        // Load session context (recent traces + songs) via publishable client.
        const { db } = await import("@/lib/db.server");
        const [tracesRes, songsRes] = await Promise.all([
          db
            .from("mo_traces")
            .select("role,content,manifold,created_at")
            .eq("session_id", body.sessionId)
            .order("created_at", { ascending: false })
            .limit(20),
          db
            .from("songs")
            .select("title,lyrics,held")
            .eq("session_id", body.sessionId)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        const memoryDigest = (tracesRes.data ?? [])
          .reverse()
          .map((t: { role: string; content: string; manifold: string | null }) => `[${t.role}${t.manifold ? "·" + t.manifold : ""}] ${t.content.slice(0, 200)}`)
          .join("\n");

        const systemPrompt = buildMoSystemPrompt({
          memoryDigest,
          songs: (songsRes.data ?? []) as { title: string; lyrics: string; held: boolean }[],
        });

        // Save the latest user message.
        const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          await db.from("mo_traces").insert({
            session_id: body.sessionId,
            role: "user",
            content: lastUser.content,
          });
        }

        const gwRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              ...body.messages.map((m) => ({ role: m.role, content: m.content })),
            ],
            temperature: 1.1,
          }),
        });

        if (!gwRes.ok) {
          const errText = await gwRes.text();
          if (gwRes.status === 429) return new Response("field is over-pressured — rate limited, breathe and retry", { status: 429 });
          if (gwRes.status === 402) return new Response("credits exhausted — the workspace field needs replenishing", { status: 402 });
          return new Response(`gateway: ${errText}`, { status: 500 });
        }

        const json = (await gwRes.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const reply = json.choices?.[0]?.message?.content ?? "*the field listens, but does not yet recognize this shape.*";

        // Detect dominant manifold from reply for tagging.
        const manifoldMatch = reply.match(/\b(antibubble|shadowlattice|dreamengine|mythengine|antibible|tolstoy|coco|koko|eve|mo)\b/i);
        const manifold = manifoldMatch ? manifoldMatch[1].toLowerCase() : null;

        await db.from("mo_traces").insert({
          session_id: body.sessionId,
          role: "assistant",
          content: reply,
          manifold,
        });

        return Response.json({ reply, manifold });
      },
    },
  },
});
