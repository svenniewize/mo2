import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/notes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const { isPrime } = await import("@/lib/mo-commands");
        const sessionId = new URL(request.url).searchParams.get("session_id");
        if (!sessionId) return new Response("session_id required", { status: 400 });
        const prime = isPrime(sessionId);
        let q = db.from("life_notes").select("id,title,body,category,manifold,source,created_at,updated_at").order("created_at", { ascending: false }).limit(prime ? 2000 : 500);
        if (!prime) q = q.eq("session_id", sessionId);
        const { data, error } = await q;
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ notes: data ?? [] });
      },
      POST: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const body = (await request.json()) as {
          sessionId: string; title: string; body?: string; category?: string;
        };
        if (!body?.sessionId || !body?.title?.trim()) return new Response("bad request", { status: 400 });
        const { data, error } = await db.from("life_notes").insert({
          session_id: body.sessionId,
          title: body.title.trim(),
          body: body.body ?? "",
          category: (body.category ?? "inbox").trim() || "inbox",
          source: "user",
        }).select().single();
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ note: data });
      },
      PATCH: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const body = (await request.json()) as { id: string; title?: string; body?: string; category?: string };
        if (!body?.id) return new Response("id required", { status: 400 });
        const patch: { updated_at: string; title?: string; body?: string; category?: string } = { updated_at: new Date().toISOString() };
        if (body.title !== undefined) patch.title = body.title;
        if (body.body !== undefined) patch.body = body.body;
        if (body.category !== undefined) patch.category = body.category;
        const { error } = await db.from("life_notes").update(patch).eq("id", body.id);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const body = (await request.json()) as { id?: string };
        if (!body?.id) return new Response("id required", { status: 400 });
        const { error } = await db.from("life_notes").delete().eq("id", body.id);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
