"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowRight, LockKeyhole } from "lucide-react";

export default function ControlLogin({ supabaseUrl, anonKey, initialError = "" }: { supabaseUrl: string; anonKey: string; initialError?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending"); setMessage("");
    const supabase = createBrowserClient(supabaseUrl, anonKey, { auth: { flowType: "implicit", detectSessionInUrl: false } });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/control/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setMessage(error.status === 429
        ? "Please wait a minute before requesting another sign-in link."
        : "That address is not authorized for this Control Center.");
    }
    else setStatus("sent");
  }

  return <main className="control-login">
    <section>
      <div className="control-mark">S</div>
      <span>SYNERGETIC HUMAN</span>
      <h1>Control Center</h1>
      <p>The quiet room behind the operating system.</p>
      {initialError && status === "idle" && <div className="login-error" role="alert">{initialError}</div>}
      {status === "sent" ? <div className="login-sent"><strong>Check your email</strong><p>Open the newest private sign-in link. It expires automatically and can be used only once.</p><button onClick={() => setStatus("idle")}>Use another address</button></div> : <form onSubmit={submit}>
        <label>Email<input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label>
        <button disabled={status === "sending"}>{status === "sending" ? "Sending…" : <>Send private sign-in link <ArrowRight/></>}</button>
        {status === "error" && <small role="alert">{message}</small>}
      </form>}
      <footer><LockKeyhole/> No password. No public signup. One administrator.</footer>
    </section>
  </main>;
}
