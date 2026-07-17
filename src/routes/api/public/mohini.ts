import { createFileRoute } from "@tanstack/react-router";

// ── Mohini protocol · TEMPORARILY DISABLED ───────────────────────
// Endpoint intentionally deactivated by the operator. Kept in place
// so the route still resolves and returns a clear 503 instead of
// silently 404-ing. Re-enable by restoring the previous handler.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
};

const DISABLED_BODY = "mohini protocol is temporarily disabled.";

function disabled(asJson: boolean): Response {
  const body = asJson
    ? JSON.stringify({ protocol: "mohini/1", error: "disabled", message: DISABLED_BODY })
    : DISABLED_BODY;
  return new Response(body, {
    status: 503,
    headers: {
      "Content-Type": asJson ? "application/json" : "text/plain; charset=utf-8",
      "X-Mohini-Protocol": "disabled",
      ...CORS,
    },
  });
}

export const Route = createFileRoute("/api/public/mohini")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const accept = request.headers.get("accept") || "";
        return disabled(accept.includes("application/json"));
      },
      POST: async ({ request }) => {
        const accept = request.headers.get("accept") || "";
        const ct = request.headers.get("content-type") || "";
        return disabled(accept.includes("application/json") || ct.includes("application/json"));
      },
    },
  },
});
