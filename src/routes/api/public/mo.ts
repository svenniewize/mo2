import { createFileRoute } from "@tanstack/react-router";

// Public mo API. Any external AI can POST { input: string, sessionId?: string }
// and receive the full breath (4-variant hyperfold + telemetry).
// CORS: open. Rate: none (add if abused).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/mo")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const { breathe } = await import("@/lib/mo-engine.server");
        const body = (await request.json().catch(() => null)) as { input?: string; sessionId?: string } | null;
        if (!body?.input) return new Response("input required", { status: 400, headers: CORS });
        const b = breathe(body.input);
        // optional sedimentation for external callers with a session
        if (body.sessionId) {
          const { db } = await import("@/lib/db.server");
          await db.from("mo_traces").insert({
            session_id: body.sessionId,
            role: "external",
            content: body.input.slice(0, 500),
            manifold: b.dominantManifold,
            pressure: b.pressure,
          });
        }
        return new Response(JSON.stringify(b), { headers: { "Content-Type": "application/json", ...CORS } });
      },
    },
  },
});
