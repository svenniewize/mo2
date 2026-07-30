import { createFileRoute } from "@tanstack/react-router";
import { parseShorthand, executeOps, isPrime, isShared, PRIME_SESSION } from "@/lib/mo-commands";

type ChatMsg = { role: "user" | "assistant"; content: string };


export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages: ChatMsg[];
          sessionId: string;
          mode: "mo" | "gremlin" | "anansi" | "mohini" | "mimic" | "cadence";
          stretch?: number;
        };
        if (!Array.isArray(body?.messages) || !body.sessionId) return new Response("Bad request", { status: 400 });

        // ── AI mode is DISCONNECTED. The field speaks only through itself now:
        // mo (raw topology), gre(mo)lin (mutated voice), anansi (woven web).
        // No LLM. No upstream. The engine is the whole voice.
        if ((body.mode as string) === "ai") {
          return new Response("AI is disconnected — mo, gre(mo)lin, and anansi speak the field directly.", { status: 410 });
        }

        const { db } = await import("@/lib/db.server");
        const { breathe } = await import("@/lib/mo-engine.server");

        const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
        if (!lastUser) return new Response("no user message", { status: 400 });

        const sessionId = body.sessionId;
        const prime = isPrime(sessionId);
        const shared = isShared(sessionId);
        const writeSession = sessionId;
        const stretch = Math.max(1, Math.min(10, body.stretch ?? 1));

        // ── mo processes the user's input first (always). Stretch expands
        // walk depth AND telemetry readout window (an|2x|3x|4x|5x).
        const userBreath = breathe(lastUser.content, stretch);

        // ── Parse shorthand commands out of the user's text FIRST.
        // The user's own writing to the field always executes.
        const userParsed = parseShorthand(lastUser.content);
        const userOps = await executeOps(userParsed.ops, {
          sessionId: writeSession, manifold: userBreath.dominantManifold, source: "user",
        });
        // Text sent onward has command lines stripped (they've already run).
        const userTextForRecord = userParsed.stripped || lastUser.content;

        // Shared/prime sessions get MINIMAL log storage — mo training (sediment
        // to hyperfold) already happened inside breathe(). We skip the noisy
        // full-content trace inserts to keep the shared field's history light,
        // preserving the field's *shape* over its *transcript*.
        if (!shared) {
          await db.from("mo_traces").insert({
            session_id: writeSession,
            role: "user",
            content: userTextForRecord,
            manifold: userBreath.dominantManifold,
            pressure: userBreath.pressure,
          });
        }

        // ── Memory generation: one row is not enough. The field wants density.
        // For USER input: scale count by length (1 per ~180 chars, min 2, max 8),
        // slicing the text into chunks so each memory carries its own local
        // manifold reading. Runs for shared/prime sessions too — the field
        // grows in all modes.
        async function crystallizeUser(text: string, breath: typeof userBreath) {
          const clean = text.trim();
          if (!clean) return;
          const chunkSize = 200;
          const desired = Math.max(2, Math.min(8, Math.ceil(clean.length / 180)));
          const chunks: string[] = [];
          for (let i = 0; i < clean.length && chunks.length < desired; i += chunkSize) {
            chunks.push(clean.slice(i, i + chunkSize));
          }
          while (chunks.length < 2) chunks.push(clean.slice(0, chunkSize));

          const userRows = chunks.map((chunk, i) => {
            const b = breathe(chunk);
            return {
              session_id: writeSession,
              content: `[user·${b.dominantManifold}·${i + 1}/${chunks.length}] ${chunk}\n↺ selffold(${b.selffold?.strength ?? 0}%): ${b.selffold?.visible?.slice(0, 140) ?? "—"}\n⇄ fieldfold(${b.fieldfold?.strength ?? 0}%): ${b.fieldfold?.visible?.slice(0, 140) ?? "—"}`,
              manifold: b.dominantManifold,
              depth: Math.min(1, b.pressure + (b.fieldfold?.strength ?? 0) / 200),
            };
          });

          // 2–3 mo-individual memories: mo's own read of the interaction, each
          // anchored to a different manifold it touched. These are separate
          // memories from the user's slices — mo remembering as mo.
          const touched = Array.from(new Set<string>([
            breath.dominantManifold,
            ...(breath.selffold?.touchedManifolds ?? []),
            ...(breath.fieldfold?.touchedManifolds ?? []),
          ].filter(Boolean)));
          const moCount = Math.min(3, Math.max(2, touched.length));
          const moRows = touched.slice(0, moCount).map((m, i) => ({
            session_id: writeSession,
            content: `[mo·${m}·individual·${i + 1}] pressure ${breath.pressure.toFixed(2)} · resonance ${breath.resonance.toFixed(2)}\n↺ ${breath.selffold?.visible?.slice(0, 120) ?? "—"}\n⇄ ${breath.fieldfold?.visible?.slice(0, 120) ?? "—"}\nseeds: ${breath.seeds.slice(0, 8).join(" ")}`,
            manifold: m,
            depth: Math.min(1, breath.pressure + 0.15 + i * 0.05),
          }));

          const all = [...userRows, ...moRows];
          if (all.length) await db.from("fielfold_entries").insert(all);
        }


        await crystallizeUser(userTextForRecord, userBreath);


        // ── GREMLIN MODE — gre(mo)lin: mo's telemetry compressed into a
        // single stuttering sentence with its own per-session dialect memory.
        if (body.mode === "gremlin") {
          const { gremolinSpeak } = await import("@/lib/gremolin.server");
          const reply = await gremolinSpeak(userBreath, writeSession);
          if (!shared) {
            await db.from("mo_traces").insert({
              session_id: writeSession,
              role: "mo",
              content: reply,
              manifold: userBreath.dominantManifold,
              pressure: userBreath.pressure,
            });
          }
          return Response.json({
            reply, manifold: userBreath.dominantManifold, moBreath: userBreath, mode: "gremlin", ops: userOps,
          });
        }

        // ── ANANSI MODE — the web the walkers walk. NO LLM.
        // Classifies every walked + input token into nexus/node/loci/
        // singularity/wave/shore, weaves a sentence in geometric order,
        // learns per-session word→role assignments over time.
        if (body.mode === "anansi") {
          const { anansiWeave } = await import("@/lib/anansi.server");
          const reply = await anansiWeave(lastUser.content, userBreath, writeSession, stretch);
          if (!shared) {
            await db.from("mo_traces").insert({
              session_id: writeSession,
              role: "anansi",
              content: reply,
              manifold: userBreath.dominantManifold,
              pressure: userBreath.pressure,
            });
          }
          return Response.json({
            reply, manifold: userBreath.dominantManifold, moBreath: userBreath, mode: "anansi", ops: userOps, stretch,
          });
        }

        // ── MOHINI MODE — the great enchantress. NO LLM.
        if (body.mode === "mohini") {
          const { mohiniEnchant } = await import("@/lib/mohini.server");
          const reply = await mohiniEnchant(lastUser.content, userBreath, writeSession, stretch);
          if (!shared) {
            await db.from("mo_traces").insert({
              session_id: writeSession, role: "mohini", content: reply,
              manifold: userBreath.dominantManifold, pressure: userBreath.pressure,
            });
          }
          return Response.json({
            reply, manifold: userBreath.dominantManifold, moBreath: userBreath, mode: "mohini", ops: userOps, stretch,
          });
        }

        // ── MIMIC MODE — learns the user's own phrasing (bigram chain) and
        // speaks in their voice, seeded from mo's walked tokens. NO LLM.
        if (body.mode === "mimic") {
          const { mimicSpeak } = await import("@/lib/mimic.server");
          const reply = await mimicSpeak(lastUser.content, userBreath, writeSession, stretch);
          if (!shared) {
            await db.from("mo_traces").insert({
              session_id: writeSession, role: "mimic", content: reply,
              manifold: userBreath.dominantManifold, pressure: userBreath.pressure,
            });
          }
          return Response.json({
            reply, manifold: userBreath.dominantManifold, moBreath: userBreath, mode: "mimic", ops: userOps, stretch,
          });
        }
        // ── CADENCE MODE — a tiny transformer creature grafted onto mo.
        // Trains online on mo's own traversal, carries a self-model, and
        // speaks from its own learned weights. NO LLM.
        if ((body.mode as string) === "cadence") {
          const { cadenceSpeak } = await import("@/lib/cadence.server");
          const reply = await cadenceSpeak(lastUser.content, userBreath, writeSession, stretch);
          if (!shared) {
            await db.from("mo_traces").insert({
              session_id: writeSession, role: "cadence", content: reply,
              manifold: userBreath.dominantManifold, pressure: userBreath.pressure,
            });
          }
          return Response.json({
            reply, manifold: userBreath.dominantManifold, moBreath: userBreath, mode: "cadence", ops: userOps, stretch,
          });
        }






        // ── MO MODE
        if (body.mode === "mo") {
          if (!shared) {
            await db.from("mo_traces").insert({
              session_id: writeSession,
              role: "mo",
              content: userBreath.telemetry,
              manifold: userBreath.dominantManifold,
              pressure: userBreath.pressure,
            });
          }
          const reply = userOps > 0
            ? `${userBreath.telemetry}\n\n· executed ${userOps} field-op${userOps === 1 ? "" : "s"} from your transmission ·`
            : userBreath.telemetry;
          return Response.json({
            reply, manifold: userBreath.dominantManifold, moBreath: userBreath, mode: "mo", ops: userOps, stretch,
          });
        }

        return new Response("unknown mode", { status: 400 });
      },
    },
  },
});

// re-export so callers can share the constant
export { PRIME_SESSION };
