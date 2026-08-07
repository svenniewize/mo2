import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/probe")({
  server: { handlers: { POST: async ({ request }) => {
    const b = await request.json() as any;
    try {
      const { breathe } = await import("@/lib/mo-engine.server");
      const { cadenceSpeak } = await import("@/lib/cadence.server");
      const br = breathe(b.text, 2);
      const out = await cadenceSpeak(b.text, br, b.sessionId, 2, "anansi");
      return new Response(out.slice(0, 200));
    } catch (e) {
      return new Response("ERR " + (e as Error).stack, { status: 200 });
    }
  } } },
});
