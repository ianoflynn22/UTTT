import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { isUsernameBlocked, BLOCKED_MSG } from "@/lib/username-filter";
import { track } from "@/lib/analytics";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useUser } from "@/hooks/use-session";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Sign in — Ultimate Tic-Tac-Toe Plus" },
      { name: "description", content: "Sign in or create an account to get a rating and play online." },
      { property: "og:title", content: "Sign in — Ultimate Tic-Tac-Toe Plus" },
      { property: "og:description", content: "Create an account to track your Elo in every mode." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const input = "w-full rounded-md border bg-background px-3 py-2";

function AuthPage() {
  const user = useUser();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [resendWait, setResendWait] = useState(0);
  useEffect(() => {
    if (resendWait <= 0) return;
    const t = setTimeout(() => setResendWait((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendWait]);
  const resend = async () => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin + "/auth" },
    });
    setMsg(error ? error.message : `Sent a new confirmation email to ${email}. Check spam too.`);
    if (!error) setResendWait(60);
  };

  useEffect(() => {
    if (user) {
      const next = sessionStorage.getItem("uttt-next");
      sessionStorage.removeItem("uttt-next");
      if (next?.startsWith("/c/")) window.location.assign(next);
      else navigate({ to: "/profile" });
    }
  }, [user, navigate]);

  const social = async (p: "google" | "apple") => {
    setMsg(null);
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) setMsg(r.error.message ?? "Sign-in failed");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const unconfirmed = /confirm/i.test(error.message);
          setMsg(unconfirmed ? "Your email isn't confirmed yet. Resend the confirmation email below." : error.message);
          if (unconfirmed) setCanResend(true);
        }
      } else if (mode === "up") {
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
          const suggestion = username.replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
          setMsg(
            suggestion.length >= 3 && suggestion.length <= 20
              ? `Usernames can only use letters, numbers and _. How about "${suggestion}"?`
              : "Usernames can only use letters, numbers and _ (3–20 characters).",
          );
          return;
        }
        if (isUsernameBlocked(username)) {
          setMsg(BLOCKED_MSG);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth", data: { username } },
        });
        if (!error) {
          track("sign_up", { method: "email" });
          setCanResend(true);
        }
        setMsg(error ? error.message : "Check your email (and spam) to confirm your account.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        setMsg(error ? error.message : "If that email has an account, a reset link is on its way.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="font-display text-3xl font-bold">
        {mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Reset password"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Get a rating in every mode and play online.</p>

      {mode !== "forgot" && (
        <div className="mt-6 grid gap-2">
          <button onClick={() => social("google")} className="rounded-md border bg-card py-2 font-medium hover:bg-accent">Continue with Google</button>
          <button onClick={() => social("apple")} className="rounded-md border bg-card py-2 font-medium hover:bg-accent">Continue with Apple</button>
          <div className="my-2 text-center font-mono text-xs uppercase text-muted-foreground">or</div>
        </div>
      )}

      <form onSubmit={submit} className="grid gap-3">
        {mode === "up" && <input className={input} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />}
        <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {mode !== "forgot" && <input className={input} type="password" placeholder="Password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />}
        <button disabled={busy} className="rounded-md bg-primary py-2 font-bold text-primary-foreground disabled:opacity-60">
          {mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}
      {canResend && mode !== "forgot" && (
        <div className="mt-3 rounded-md border bg-card p-3 text-sm">
          <p className="text-muted-foreground">Didn't get the confirmation email?</p>
          <button
            type="button"
            disabled={!email || resendWait > 0}
            onClick={resend}
            className="mt-2 rounded-md border px-3 py-1.5 font-medium hover:bg-accent disabled:opacity-50"
          >
            {resendWait > 0 ? `Resend available in ${resendWait}s` : "Resend confirmation email"}
          </button>
        </div>
      )}
      {mode === "in" && !canResend && (
        <button type="button" onClick={() => setCanResend(true)} className="mt-3 text-xs text-muted-foreground underline hover:text-foreground">
          Didn't get your confirmation email?
        </button>
      )}

      <div className="mt-6 flex justify-between text-sm text-muted-foreground">
        <button onClick={() => setMode(mode === "up" ? "in" : "up")} className="hover:text-foreground">
          {mode === "up" ? "Have an account? Sign in" : "New here? Create account"}
        </button>
        {mode === "in" && <button onClick={() => setMode("forgot")} className="hover:text-foreground">Forgot password?</button>}
      </div>
    </main>
  );
}
