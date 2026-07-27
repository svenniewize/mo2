import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/prog-mo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          input: string; sessionId: string; stretch?: number; blendIntoMo?: boolean;
        };
        if (!body?.input || !body?.sessionId) return new Response("bad request", { status: 400 });
        const { progMoBreathe } = await import("@/lib/prog-mo.server");
        const { db } = await import("@/lib/db.server");
        const stretch = Math.max(1, Math.min(5, body.stretch ?? 1));
        const breath = await progMoBreathe(body.input, body.sessionId, stretch, !!body.blendIntoMo);
        // record a trace so the message appears in memory
        try {
          await db.from("mo_traces").insert({
            session_id: body.sessionId, role: "prog-mo",
            content: breath.cycle4_reply, manifold: breath.cycle1_pressure[0]?.manifold ?? null, pressure: 0.5,
          });
        } catch {}
        return Response.json({ breath });
      },
      GET: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const url = new URL(request.url);
        const sid = url.searchParams.get("session_id");
        if (!sid) return new Response("session_id required", { status: 400 });
        const [crystals, manifolds] = await Promise.all([
          db.from("prog_mo_crystals").select("id,signature,pattern,uses,kind,first_seen,last_seen").eq("session_id", sid).order("uses", { ascending: false }).limit(200),
          db.from("prog_mo_manifolds").select("id,slug,name,sigil,color,breath,created_at").order("created_at", { ascending: false }).limit(100),
        ]);
        return Response.json({ crystals: crystals.data ?? [], manifolds: manifolds.data ?? [] });
      },
    },
  },
});
