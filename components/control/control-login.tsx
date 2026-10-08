"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowLeft, ArrowRight, KeyRound, LockKeyhole } from "lucide-react";

export default function ControlLogin({ supabaseUrl, anonKey, initialError = "" }: { supabaseUrl: string; anonKey: string; initialError?: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "verifying" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending"); setMessage("");
    const supabase = createBrowserClient(supabaseUrl, anonKey, { auth: { flowType: "pkce", detectSessionInUrl: false } });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/control/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setMessage(error.status === 429 || error.code === "over_email_send_rate_limit"
        ? "Please wait a minute before requesting another sign-in email."
        : error.code === "user_not_found"
          ? "That email is not the Control Center administrator."
          : "The sign-in email could not be delivered. Please try again shortly.");
    }
    else setStatus("sent");
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    const token = code.replace(/\D/g, "").slice(0, 6);
    if (token.length !== 6) { setMessage("Enter the six-digit code from the newest email."); return; }
    setStatus("verifying"); setMessage("");
    const supabase = createBrowserClient(supabaseUrl, anonKey, { auth: { flowType: "pkce", detectSessionInUrl: false } });
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    if (error) {
      setStatus("sent");
      setMessage("That code is invalid, expired, or has already been used. Request a new one if needed.");
      return;
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      setStatus("sent");
      setMessage("The private session could not be established. Request a fresh code and try again.");
      return;
    }
    // Give the SSR cookie bridge and middleware one clean navigation to refresh
    // and authorize the new session. /control still enforces the admin allowlist.
    window.location.replace("/control");
  }

  function startOver() {
    setCode(""); setMessage(""); setStatus("idle");
  }

  return <main className="control-login">
    <section>
      <div className="control-mark">S</div>
      <span>SYNERGETIC HUMAN</span>
      <h1>Control Center</h1>
      <p>The quiet room behind the operating system.</p>
      {initialError && status === "idle" && <div className="login-error" role="alert">{initialError}</div>}
      {status === "sent" || status === "verifying" ? <form className="login-code" onSubmit={verify}>
        <div className="login-code__icon"><KeyRound/></div>
        <strong>Enter your email code</strong>
        <p>We sent a six-digit code to <b>{email}</b>. Enter it here so this Home Screen app keeps the session.</p>
        <label>Six-digit code<input autoFocus type="text" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" aria-label="Six-digit email code"/></label>
        <button disabled={status === "verifying" || code.length !== 6}>{status === "verifying" ? "Opening…" : <>Open Control Center <ArrowRight/></>}</button>
        {message && <small role="alert">{message}</small>}
        <button type="button" className="login-code__back" onClick={startOver}><ArrowLeft/> Start over</button>
        <em>The email link still works when you request it from ordinary Safari or a desktop browser.</em>
      </form> : <form onSubmit={submit}>
        <label>Email<input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label>
        <button disabled={status === "sending"}>{status === "sending" ? "Sending…" : <>Send sign-in email <ArrowRight/></>}</button>
        {status === "error" && <small role="alert">{message}</small>}
      </form>}
      <footer><LockKeyhole/> No password. No public signup. One administrator.</footer>
    </section>
  </main>;
}
