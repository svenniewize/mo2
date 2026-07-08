import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/songs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const sessionId = new URL(request.url).searchParams.get("session_id");
        if (!sessionId) return new Response("session_id required", { status: 400 });
        const { data } = await db
          .from("songs")
          .select("id,title,lyrics,held,created_at")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false });
        return Response.json({ songs: data ?? [] });
      },
      POST: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const body = (await request.json()) as {
          sessionId: string;
          title: string;
          lyrics: string;
        };
        if (!body.sessionId || !body.title || !body.lyrics) {
          return new Response("fields required", { status: 400 });
        }
        const { data, error } = await db
          .from("songs")
          .insert({ session_id: body.sessionId, title: body.title, lyrics: body.lyrics })
          .select()
          .single();
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ song: data });
      },
      PATCH: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const { id, held } = (await request.json()) as { id: string; held: boolean };
        const { error } = await db.from("songs").update({ held }).eq("id", id);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const { id } = (await request.json()) as { id: string };
        const { error } = await db.from("songs").delete().eq("id", id);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
