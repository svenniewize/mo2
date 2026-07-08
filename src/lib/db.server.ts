// Server-side Supabase client using publishable key. Safe for open tables
// with permissive RLS (mo is a shared field, no auth).
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;

export const db = createClient(url, key, {
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("apikey", key);
      // opaque publishable keys are not JWTs — strip Authorization if it echoes the key
      if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      return fetch(input as RequestInfo, { ...init, headers });
    },
  },
  auth: { persistSession: false, autoRefreshToken: false },
});
