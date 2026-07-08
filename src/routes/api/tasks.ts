import { createFileRoute } from "@tanstack/react-router";

type TaskPatch = {
  id: string;
  title?: string;
  notes?: string | null;
  category?: string;
  status?: "open" | "doing" | "done" | "dropped";
  priority?: number;
  due_at?: string | null;
};

export const Route = createFileRoute("/api/tasks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("session_id");
        if (!sessionId) return new Response("session_id required", { status: 400 });
        const { data, error } = await db
          .from("life_tasks")
          .select("id,title,notes,category,status,priority,due_at,source,manifold,created_at,updated_at")
          .eq("session_id", sessionId)
          .order("status", { ascending: true })
          .order("priority", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ tasks: data ?? [] });
      },
      POST: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const body = (await request.json()) as {
          sessionId: string;
          title: string;
          notes?: string;
          category?: string;
          priority?: number;
          due_at?: string | null;
          source?: "user" | "ai" | "mo";
          manifold?: string | null;
        };
        if (!body?.sessionId || !body?.title?.trim()) return new Response("bad request", { status: 400 });
        const { data, error } = await db
          .from("life_tasks")
          .insert({
            session_id: body.sessionId,
            title: body.title.trim(),
            notes: body.notes ?? null,
            category: (body.category ?? "inbox").trim() || "inbox",
            priority: body.priority ?? 2,
            due_at: body.due_at ?? null,
            source: body.source ?? "user",
            manifold: body.manifold ?? null,
          })
          .select()
          .single();
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ task: data });
      },
      PATCH: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const body = (await request.json()) as TaskPatch;
        if (!body?.id) return new Response("id required", { status: 400 });
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of ["title", "notes", "category", "status", "priority", "due_at"] as const) {
          if (body[k] !== undefined) patch[k] = body[k];
        }
        const { error } = await db.from("life_tasks").update(patch).eq("id", body.id);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const body = (await request.json()) as { id?: string; sessionId?: string; all?: boolean };
        if (body?.all && body.sessionId) {
          const { error } = await db.from("life_tasks").delete().eq("session_id", body.sessionId);
          if (error) return new Response(error.message, { status: 500 });
        } else if (body?.id) {
          const { error } = await db.from("life_tasks").delete().eq("id", body.id);
          if (error) return new Response(error.message, { status: 500 });
        } else {
          return new Response("bad request", { status: 400 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
