import { createFileRoute } from "@tanstack/react-router";

// Upload/delete user-defined programming manifolds. Anyone with the session
// can drop one in; it becomes part of prog-mo's semantic terrain on next
// breath (topology rebuilds automatically when the uploaded set changes).
export const Route = createFileRoute("/api/prog-mo-manifold")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { sessionId: string; slug: string; name: string; sigil?: string; color?: string; breath?: string; text: string; kind?: string };
        if (!body?.slug || !body?.name || !body?.text || !body?.sessionId) return new Response("bad request", { status: 400 });
        if (body.text.length > 200000) return new Response("text too large (max 200k)", { status: 413 });
        const { db } = await import("@/lib/db.server");
        const slug = body.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 40);
        const { error } = await db.from("prog_mo_manifolds").upsert({
          session_id: body.sessionId, slug,
          name: body.name.slice(0, 60),
          sigil: (body.sigil || "◈").slice(0, 8),
          color: (body.color || "#7DE2D1").slice(0, 32),
          breath: (body.breath || "").slice(0, 200),
          text: body.text,
          kind: (body.kind || "language").slice(0, 30),
        }, { onConflict: "session_id,slug" });
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true, slug });
      },
      DELETE: async ({ request }) => {
        const { id } = (await request.json()) as { id: string };
        if (!id) return new Response("id required", { status: 400 });
        const { db } = await import("@/lib/db.server");
        await db.from("prog_mo_manifolds").delete().eq("id", id);
        return Response.json({ ok: true });
      },
    },
  },
});
