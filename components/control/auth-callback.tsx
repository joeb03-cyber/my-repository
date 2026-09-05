"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, LockKeyhole } from "lucide-react";

export default function AuthCallback({ supabaseUrl, anonKey }: { supabaseUrl: string; anonKey: string }) {
  const [message, setMessage] = useState("Securing your private session…");

  useEffect(() => {
    let active = true;
    async function finish() {
      // Supabase Auth initializes as the browser client is created. For a PKCE
      // callback it consumes the URL code and its verifier exactly once. Calling
      // exchangeCodeForSession here as well would race that built-in exchange.
      const supabase = createBrowserClient(supabaseUrl, anonKey, { auth: { flowType: "pkce", detectSessionInUrl: true } });
      const { error: initializationError } = await supabase.auth.initialize();
      window.history.replaceState({}, document.title, "/control/auth/callback");
      if (initializationError) throw new Error("This sign-in link is invalid, expired, or has already been used.");

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) throw new Error("This sign-in link is incomplete, expired, or has already been used.");
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
