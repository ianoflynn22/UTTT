import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Set a new password — Ultimate Tic-Tac-Toe Plus" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Choose a new password for your account." },
      { property: "og:title", content: "Set a new password" },
      { property: "og:description", content: "Choose a new password for your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setMsg(error.message);
    else navigate({ to: "/profile" });
  };
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="font-display text-3xl font-bold">New password</h1>
      <form onSubmit={save} className="mt-6 grid gap-3">
        <input type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="rounded-md border bg-background px-3 py-2" />
        <button className="rounded-md bg-primary py-2 font-bold text-primary-foreground">Save password</button>
      </form>
      {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}
    </main>
  );
}
