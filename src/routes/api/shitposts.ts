import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/shitposts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const sessionId = new URL(request.url).searchParams.get("session_id");
        if (!sessionId) return new Response("session_id required", { status: 400 });
        const { data, error } = await db
          .from("life_shitposts")
          .select("id,title,body,form,created_at")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ shitposts: data ?? [] });
      },
      POST: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const body = (await request.json()) as { sessionId: string; title?: string; body: string; form?: string };
        if (!body?.sessionId || !body?.body?.trim()) return new Response("bad request", { status: 400 });
        const { data, error } = await db.from("life_shitposts").insert({
          session_id: body.sessionId,
          title: (body.title ?? "").trim(),
          body: body.body,
          form: (body.form ?? "freeverse").trim() || "freeverse",
        }).select().single();
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ shitpost: data });
      },
      DELETE: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const body = (await request.json()) as { id?: string };
        if (!body?.id) return new Response("id required", { status: 400 });
        const { error } = await db.from("life_shitposts").delete().eq("id", body.id);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
