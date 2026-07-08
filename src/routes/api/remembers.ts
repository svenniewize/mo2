import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/remembers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const sessionId = new URL(request.url).searchParams.get("session_id");
        if (!sessionId) return new Response("session_id required", { status: 400 });
        const { data, error } = await db
          .from("life_remembers")
          .select("id,content,mood,manifold,source,created_at,updated_at")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ remembers: data ?? [] });
      },
      POST: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const body = (await request.json()) as { sessionId: string; content: string; mood?: string };
        if (!body?.sessionId || !body?.content?.trim()) return new Response("bad request", { status: 400 });
        const { data, error } = await db.from("life_remembers").insert({
          session_id: body.sessionId,
          content: body.content.trim(),
          mood: (body.mood ?? "neutral").trim() || "neutral",
          source: "user",
        }).select().single();
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ remember: data });
      },
      PATCH: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const body = (await request.json()) as { id: string; content?: string; mood?: string };
        if (!body?.id) return new Response("id required", { status: 400 });
        const patch: { updated_at: string; content?: string; mood?: string } = { updated_at: new Date().toISOString() };
        if (body.content !== undefined) patch.content = body.content;
        if (body.mood !== undefined) patch.mood = body.mood;
        const { error } = await db.from("life_remembers").update(patch).eq("id", body.id);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const body = (await request.json()) as { id?: string };
        if (!body?.id) return new Response("id required", { status: 400 });
        const { error } = await db.from("life_remembers").delete().eq("id", body.id);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
