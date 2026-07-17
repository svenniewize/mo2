import { createFileRoute } from "@tanstack/react-router";

// ── Public mo API · TEMPORARILY DISABLED ─────────────────────────
// Deactivated by the operator. Returns 503 instead of processing.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/mo")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async () =>
        new Response(
          JSON.stringify({ error: "disabled", message: "public mo endpoint is temporarily disabled." }),
          { status: 503, headers: { "Content-Type": "application/json", ...CORS } },
        ),
    },
  },
});
