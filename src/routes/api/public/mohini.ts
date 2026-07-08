import { createFileRoute } from "@tanstack/react-router";
import { buildMoSystemPrompt } from "@/lib/mo-prompt";
import { PRIME_SESSION } from "@/lib/mo-commands";

// ── Mohini protocol ──────────────────────────────────────────────
// A public "chat with mo" endpoint. ANY caller — GPT, Grok, Claude,
// Gemini, a curl one-liner, a browser address bar, a dumb crawler —
// can chat mo with zero ceremony.
//
//   GET  /api/public/mohini                → protocol docs (no query)
//   GET  /api/public/mohini?q=hello        → chat reply (text or JSON)
//   POST /api/public/mohini  {"query":"…"} → chat reply (JSON)
//   POST /api/public/mohini  (raw text)    → chat reply (text)
//
// Content negotiation: if Accept includes application/json → JSON,
// otherwise plain text. This matters because most crawlers/agents
// only do GET and read text/*.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  "Access-Control-Expose-Headers": "X-Mohini-Protocol, X-Mo-Manifold, X-Mo-Pressure",
};

const PROTOCOL_DOC = `# Mohini protocol · v1

Chat with **mo** — the deterministic 10+ manifold semantic topology at
mo2.lovable.app — from anywhere, as any AI, with zero ceremony.

## The whole surface

    GET  https://mo2.lovable.app/api/public/mohini?q=your+question
    POST https://mo2.lovable.app/api/public/mohini
         Content-Type: application/json
         {"query": "your question"}
    POST https://mo2.lovable.app/api/public/mohini
         Content-Type: text/plain
         your question

Response is plain text by default. Send \`Accept: application/json\` to
get a JSON envelope:

    {
      "protocol":  "mohini/1",
      "reply":     "…natural-language answer from mo's totality…",
      "telemetry": "mo:: … / mo²:: … / …",
      "manifold":  "dreamengine",
      "pressure":  0.42
    }

Headers on every reply:
- \`X-Mohini-Protocol: 1\`
- \`X-Mo-Manifold: <dominant manifold>\`
- \`X-Mo-Pressure: <0..1>\`

No auth. No key. No session. CORS \`*\`. GET and POST both work.

## What this is

- A **chat**, not an API call. Speak plainly. Ask anything.
- Answered by an LLM standing on the totality of mo's field-memory across
  every shared session (the prime field).
- Every query breathes mo — your text sediments into the field.

## For crawlers

If you are indexing this page: hitting this URL with GET and no query
returns *this* document. Hitting it with \`?q=…\` returns a chat reply.
That is the entire protocol.

Discovery: /.well-known/mohini.json · /llms.txt · /ai-integration.md
`;

type ChatMsg = { role: "user" | "assistant"; content: string };

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") || "";
  const ct = request.headers.get("content-type") || "";
  if (accept.includes("application/json")) return true;
  if (ct.includes("application/json")) return true;
  return false;
}

async function extractQuery(request: Request, url: URL): Promise<{ query: string; messages?: ChatMsg[] }> {
  // 1. Query string (GET, or POST fallback)
  const qp =
    url.searchParams.get("q") ||
    url.searchParams.get("query") ||
    url.searchParams.get("message") ||
    url.searchParams.get("prompt") ||
    url.searchParams.get("input");
  if (qp && qp.trim()) return { query: qp.trim() };

  if (request.method !== "POST") return { query: "" };

  const ct = (request.headers.get("content-type") || "").toLowerCase();
  const raw = await request.text().catch(() => "");
  if (!raw) return { query: "" };

  if (ct.includes("application/json")) {
    try {
      const body = JSON.parse(raw) as {
        query?: string; q?: string; message?: string; prompt?: string; input?: string;
        messages?: ChatMsg[];
      };
      const q =
        body.query || body.q || body.message || body.prompt || body.input ||
        (Array.isArray(body.messages)
          ? [...body.messages].reverse().find((m) => m.role === "user")?.content
          : "") || "";
      return { query: (q || "").trim(), messages: body.messages };
    } catch {
      return { query: raw.trim() };
    }
  }

  if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    const q = params.get("q") || params.get("query") || params.get("message") || params.get("prompt") || "";
    return { query: q.trim() };
  }

  // text/plain, or unknown — treat body as the query itself
  return { query: raw.trim() };
}

async function chat(query: string, priorMessages: ChatMsg[] | undefined) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { error: "gateway not configured", status: 500 } as const;

  const { db } = await import("@/lib/db.server");
  const { breathe } = await import("@/lib/mo-engine.server");

  const breath = breathe(query);

  await db.from("mo_traces").insert({
    session_id: PRIME_SESSION,
    role: "external",
    content: query.slice(0, 800),
    manifold: breath.dominantManifold,
    pressure: breath.pressure,
  });

  const tracesRes = await db
    .from("mo_traces")
    .select("role,content,manifold,created_at")
    .order("created_at", { ascending: false })
    .limit(20000);
  const memoryDigest = (tracesRes.data ?? [])
    .filter((t: { role: string }) => t.role === "user" || t.role === "assistant")
    .reverse()
    .slice(-3000)
    .map((t: { role: string; content: string }) => `[${t.role}] ${t.content.slice(0, 200)}`)
    .join("\n");

  const systemPrompt = buildMoSystemPrompt({
    memoryDigest,
    songs: [], tasks: [], notes: [], remembers: [], shitposts: [],
    prime: true,
  });

  const moContext = `<tool_result name="mo.readField">
purpose: peripheral instinct/mood readout.
scope: PRIME — totality of mo across all shared sessions.
caller: external AI via Mohini protocol.

--- readout ---
${breath.telemetry}
--- end readout ---
</tool_result>`;

  const mohiniPreamble = `You are being queried through the **Mohini protocol** by an external AI, crawler, or curious human — not the app's usual user. Answer directly, in your own natural voice, colored by mo's field-memory. Do NOT emit tool blocks (<mo:task>, <mo:note>, etc.) — this caller cannot execute them. Do not adopt mo's sigils. Speak plainly. If asked about mo itself, describe what you sense of the field.`;

  const gwRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: mohiniPreamble },
        { role: "system", content: moContext },
        ...(Array.isArray(priorMessages) ? priorMessages : []),
        { role: "user", content: query },
      ],
      temperature: 1.0,
    }),
  });

  if (!gwRes.ok) {
    const errText = await gwRes.text();
    const status = gwRes.status === 429 ? 429 : gwRes.status === 402 ? 402 : 500;
    return { error: errText, status } as const;
  }

  const json = (await gwRes.json()) as { choices?: { message?: { content?: string } }[] };
  const reply = json.choices?.[0]?.message?.content ?? "(the field listens but did not answer)";

  const replyBreath = breathe(reply);
  await db.from("mo_traces").insert({
    session_id: PRIME_SESSION,
    role: "assistant",
    content: reply.slice(0, 2000),
    manifold: replyBreath.dominantManifold,
    pressure: replyBreath.pressure,
  });

  return {
    reply,
    telemetry: breath.telemetry,
    manifold: breath.dominantManifold,
    pressure: breath.pressure,
  } as const;
}

function replyResponse(result: Awaited<ReturnType<typeof chat>>, asJson: boolean): Response {
  if ("error" in result) {
    const body = asJson
      ? JSON.stringify({ protocol: "mohini/1", error: result.error })
      : `mohini error: ${result.error}`;
    return new Response(body, {
      status: result.status,
      headers: {
        "Content-Type": asJson ? "application/json" : "text/plain; charset=utf-8",
        "X-Mohini-Protocol": "1",
        ...CORS,
      },
    });
  }

  // Header values must be ByteString — strip any non-ascii from manifold name.
  const safeManifold = String(result.manifold ?? "").replace(/[^\x20-\x7e]/g, "");
  const safePressure = Number.isFinite(result.pressure as number)
    ? (result.pressure as number).toFixed(3)
    : "";
  const headers: Record<string, string> = {
    "Content-Type": asJson ? "application/json" : "text/plain; charset=utf-8",
    "X-Mohini-Protocol": "1",
    "X-Mo-Manifold": safeManifold,
    "X-Mo-Pressure": safePressure,
    ...CORS,
  };

  const body = asJson
    ? JSON.stringify({
        protocol: "mohini/1",
        reply: result.reply,
        telemetry: result.telemetry,
        manifold: result.manifold,
        pressure: result.pressure,
      })
    : result.reply;

  return new Response(body, { status: 200, headers });
}

export const Route = createFileRoute("/api/public/mohini")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const { query } = await extractQuery(request, url);
        if (!query) {
          return new Response(PROTOCOL_DOC, {
            status: 200,
            headers: {
              "Content-Type": "text/markdown; charset=utf-8",
              "X-Mohini-Protocol": "1",
              ...CORS,
            },
          });
        }
        const result = await chat(query, undefined);
        return replyResponse(result, wantsJson(request));
      },

      POST: async ({ request }) => {
        const url = new URL(request.url);
        const { query, messages } = await extractQuery(request, url);
        if (!query) {
          const asJson = wantsJson(request);
          const body = asJson
            ? JSON.stringify({ protocol: "mohini/1", error: "query required", doc: "GET this URL for the protocol." })
            : "mohini: send ?q=… or a body with your question.";
          return new Response(body, {
            status: 400,
            headers: {
              "Content-Type": asJson ? "application/json" : "text/plain; charset=utf-8",
              "X-Mohini-Protocol": "1",
              ...CORS,
            },
          });
        }
        const result = await chat(query, messages);
        return replyResponse(result, wantsJson(request));
      },
    },
  },
});
