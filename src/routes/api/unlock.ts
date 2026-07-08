// Password-gated shared memory access.
// Each password maps to a *specific* sessionId — enter the right word and
// you land inside that field's memory. Unknown passwords are rejected.
// Add more passwords by appending to PASSWORDS below.
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

// password → the exact session_id in the DB that unlock grants access to.
const PASSWORDS: Record<string, string> = {
  // the original dev-preview field (working session with existing memory)
  garfieldkekeke: "a7f91ef6-14a5-492a-9c02-3d4f0b888bdc",
  // fresh shared field for anyone who knows the trickster word
  tricksterkekeke: "shared:trickster",
};

function sha256(s: string) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// Precompute hashes so comparison is constant-time.
const HASHES: { hash: Buffer; sessionId: string }[] = Object.entries(PASSWORDS).map(
  ([pw, sid]) => ({ hash: Buffer.from(sha256(pw), "hex"), sessionId: sid }),
);

export const Route = createFileRoute("/api/unlock")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { password } = (await request.json()) as { password?: string };
        if (typeof password !== "string" || password.length < 3 || password.length > 200) {
          return new Response("bad password", { status: 400 });
        }
        const given = Buffer.from(sha256(password), "hex");
        for (const { hash, sessionId } of HASHES) {
          if (given.length === hash.length && timingSafeEqual(given, hash)) {
            return Response.json({ sessionId, shared: true });
          }
        }
        return new Response("nope", { status: 401 });
      },
    },
  },
});
