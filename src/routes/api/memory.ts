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

        const pageSize = 1000;
        async function readPages(table: "mo_traces" | "fielfold_entries", fields: string) {
          const rows: unknown[] = [];
          for (let from = 0; from < 50000; from += pageSize) {
            let query = db.from(table).select(fields).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
            if (!prime) query = query.eq("session_id", sessionId);
            const { data, error } = await query;
            if (error) throw error;
            rows.push(...(data ?? []));
            if (!data || data.length < pageSize) break;
          }
          return rows;
        }
        const [traces, fielfold] = await Promise.all([
          readPages("mo_traces", "id,role,content,manifold,pressure,created_at"),
          readPages("fielfold_entries", "id,content,manifold,depth,created_at"),
        ]);

        return Response.json({
          traces,
          fielfold,
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
