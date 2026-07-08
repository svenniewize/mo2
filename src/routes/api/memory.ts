import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/memory")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const { isPrime } = await import("@/lib/mo-commands");
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("session_id");
        if (!sessionId) return new Response("session_id required", { status: 400 });
        const prime = isPrime(sessionId);

        const tracesQ = db.from("mo_traces").select("id,role,content,manifold,pressure,created_at").order("created_at", { ascending: false }).limit(prime ? 400 : 200);
        const foldQ = db.from("fielfold_entries").select("id,content,manifold,depth,created_at").order("created_at", { ascending: false }).limit(prime ? 200 : 50);
        const [traces, fielfold] = await Promise.all([
          prime ? tracesQ : tracesQ.eq("session_id", sessionId),
          prime ? foldQ : foldQ.eq("session_id", sessionId),
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
