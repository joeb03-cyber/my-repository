"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, LockKeyhole } from "lucide-react";

export default function AuthCallback({ supabaseUrl, anonKey }: { supabaseUrl: string; anonKey: string }) {
  const [message, setMessage] = useState("Securing your private session…");

  useEffect(() => {
    let active = true;
    async function finish() {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const errorDescription = fragment.get("error_description");
      if (errorDescription) throw new Error(errorDescription);
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      const code = new URL(window.location.href).searchParams.get("code");
      const supabase = createBrowserClient(supabaseUrl, anonKey, { auth: { flowType: "pkce", detectSessionInUrl: false } });
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        window.history.replaceState({}, document.title, "/control/auth/callback");
      } else if (accessToken && refreshToken) {
        // Complete any already-issued implicit link during the transition to PKCE.
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) throw error;
        window.history.replaceState({}, document.title, "/control/auth/callback");
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error("This link is incomplete, expired, or has already been used.");
      }
      const response = await fetch("/api/control/content", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "This account is not authorized for Control Center." : "The private session could not be verified.");
      if (active) window.location.replace("/control");
    }
    finish().catch((error) => {
      if (!active) return;
      window.history.replaceState({}, document.title, "/control/auth/callback");
      setMessage(error instanceof Error ? error.message : "The sign-in link could not be completed.");
      window.setTimeout(() => window.location.replace("/control/login?error=expired"), 2200);
    });
    return () => { active = false; };
  }, [anonKey, supabaseUrl]);

  return <main className="control-login"><section className="auth-finishing"><div className="control-mark">S</div><Loader2/><span>SYNERGETIC HUMAN</span><h1>Opening Control Center</h1><p>{message}</p><footer><LockKeyhole/> The email credential is being exchanged for a secure staging session.</footer></section></main>;
}
