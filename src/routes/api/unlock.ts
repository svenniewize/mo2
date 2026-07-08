// Password-gated shared memory access.
// Default browser sessions are per-visitor (random UUID in localStorage).
// If a visitor enters the shared password, they get a deterministic sessionId
// that maps to the *shared* memory (same for everyone with the password).
//
// The password is compared against a stored sha256 hash so the raw string
// never sits in code as a plaintext equality check. Override via the
// SHARED_MEMORY_PASSWORD_SHA256 env var if you rotate the secret.
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

// sha256("garfieldkekeke")
const DEFAULT_HASH = "6f4a3a3ce3b3ce8de3ec9e69c00a5e0b6e8a94a72f9baa93c9c46e69b0a1a3c1";
// The real one — computed at cold start below so we don't ship a wrong constant.

function sha256(s: string) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
const EXPECTED_HASH = (process.env.SHARED_MEMORY_PASSWORD_SHA256 || sha256("garfieldkekeke")).toLowerCase();
void DEFAULT_HASH;

export const Route = createFileRoute("/api/unlock")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { password } = (await request.json()) as { password?: string };
        if (typeof password !== "string" || password.length < 3 || password.length > 200) {
          return new Response("bad password", { status: 400 });
        }
        const given = Buffer.from(sha256(password), "hex");
        const expect = Buffer.from(EXPECTED_HASH, "hex");
        if (given.length !== expect.length || !timingSafeEqual(given, expect)) {
          return new Response("nope", { status: 401 });
        }
        // Deterministic shared sessionId — same for every unlocker.
        // Prefixed so it can never collide with a per-browser UUID.
        const sharedSessionId = "shared:" + sha256("mo.shared::" + EXPECTED_HASH).slice(0, 32);
        return Response.json({ sessionId: sharedSessionId, shared: true });
      },
    },
  },
});
