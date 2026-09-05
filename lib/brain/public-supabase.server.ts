import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Public Brain reads are editorially live. Next's server fetch cache must not
 * hold an older PostgREST response after Joe publishes a Control Center edit.
 */
export function publicBrainClient() {
  const url = process.env.BRAIN_SUPABASE_URL;
  const key = process.env.BRAIN_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Staging Brain public credentials are required.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
