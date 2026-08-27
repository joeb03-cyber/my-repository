import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createBrainAuthClient(cookieStore = cookies()) {
  const url = process.env.BRAIN_SUPABASE_URL;
  const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Staging Brain environment is unavailable.");
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value; },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }); } catch { /* Middleware refreshes server-component sessions. */ }
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: "", ...options }); } catch { /* Middleware refreshes server-component sessions. */ }
      },
    },
  });
}

export async function getControlAdmin() {
  const supabase = createBrainAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: admin } = await supabase.from("brain_admin_users").select("user_id,email,display_name,active").eq("user_id", user.id).eq("active", true).maybeSingle();
  return admin ? { supabase, user, admin } : null;
}
