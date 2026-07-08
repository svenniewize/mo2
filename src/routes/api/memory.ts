import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/memory")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("session_id");
        if (!sessionId) return new Response("session_id required", { status: 400 });

        const [traces, fielfold] = await Promise.all([
          db
            .from("mo_traces")
            .select("id,role,content,manifold,pressure,created_at")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(200),
          db
            .from("fielfold_entries")
            .select("id,content,manifold,depth,created_at")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

        return Response.json({
          traces: traces.data ?? [],
          fielfold: fielfold.data ?? [],
        });
      },
      DELETE: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const { id, sessionId, kind, all } = (await request.json()) as {
          id?: string;
          sessionId: string;
          kind: "trace" | "fielfold";
          all?: boolean;
        };
        const table = kind === "fielfold" ? "fielfold_entries" : "mo_traces";
        if (all) {
          const { error } = await db.from(table).delete().eq("session_id", sessionId);
          if (error) return new Response(error.message, { status: 500 });
        } else if (id) {
          const { error } = await db.from(table).delete().eq("id", id);
          if (error) return new Response(error.message, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
