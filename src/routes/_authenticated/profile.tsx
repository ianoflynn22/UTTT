import { createFileRoute } from "@tanstack/react-router";
import { isUsernameBlocked, BLOCKED_MSG } from "@/lib/username-filter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MODE_INFO, type Mode } from "@/lib/game";
import { countryList, flag } from "@/lib/countries";
import { Wld } from "@/components/rating-bits";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Your profile — Ultimate Tic-Tac-Toe Plus" },
      { name: "description", content: "Your username, country and ratings." },
      { property: "og:title", content: "Your profile" },
      { property: "og:description", content: "Your username, country and ratings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("username, country").eq("id", user.id).single(),
        supabase.from("ratings").select("*").eq("user_id", user.id),
      ]);
      if (p.error) throw p.error;
      return { profile: p.data, ratings: r.data ?? [] };
    },
  });
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (data) {
      setUsername(data.profile.username);
      setCountry(data.profile.country ?? "");
    }
  }, [data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return setMsg("Username: 3–20 letters, numbers or _");
    if (isUsernameBlocked(username)) return setMsg(BLOCKED_MSG);
    const { error } = await supabase.from("profiles").update({ username, country: country || null }).eq("id", user.id);
    setMsg(error ? (error.code === "23505" ? "That username is taken." : error.message.includes("USERNAME_BLOCKED") ? BLOCKED_MSG : error.message) : "Saved.");
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">
        {flag(data?.profile.country)} {data?.profile.username ?? "…"}
      </h1>
      <form onSubmit={save} className="mt-6 grid gap-3 rounded-xl border bg-card p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-sm">
          <span className="font-mono text-xs uppercase text-muted-foreground">Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="rounded-md border bg-background px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-mono text-xs uppercase text-muted-foreground">Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-md border bg-background px-3 py-2">
            <option value="">—</option>
            {countryList().map((c) => <option key={c.code} value={c.code}>{flag(c.code)} {c.name}</option>)}
          </select>
        </label>
        <button className="rounded-md bg-primary px-5 py-2 font-bold text-primary-foreground">Save</button>
        {msg && <p className="text-sm text-muted-foreground sm:col-span-3">{msg}</p>}
      </form>

      <h2 className="mt-8 font-display text-xl font-bold">Ratings</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(Object.keys(MODE_INFO) as Mode[]).map((m) => {
          const r = data?.ratings.find((x) => x.mode === m);
          return (
            <div key={m} className="rounded-xl border bg-card p-4">
              <p className="font-mono text-xs uppercase text-muted-foreground">{MODE_INFO[m].name}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-primary tabular-nums">{r?.elo ?? 0}</p>
              <Wld w={r?.wins ?? 0} l={r?.losses ?? 0} d={r?.draws ?? 0} className="mt-2" />
            </div>
          );
        })}
      </div>

      <DeleteAccount />
    </main>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete account");
      setBusy(false);
    }
  };
  return (
    <section className="mt-10 rounded-xl border border-destructive/40 p-4">
      <h2 className="font-display text-xl font-bold">Delete account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Permanently removes your login, ratings, friends, puzzle streaks and analyses. Past games stay in your opponents' history, shown as "deleted-user". This can't be undone.
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-3 rounded-md border border-destructive px-4 py-2 text-sm font-bold text-destructive hover:bg-destructive/10">
          Delete my account
        </button>
      ) : (
        <div className="mt-3 grid gap-2 sm:max-w-sm">
          <label className="text-sm">Type <span className="font-mono font-bold">DELETE</span> to confirm</label>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="rounded-md border bg-background px-3 py-2" />
          <div className="flex gap-2">
            <button disabled={confirm !== "DELETE" || busy} onClick={run} className="rounded-md bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-50">
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button onClick={() => { setOpen(false); setConfirm(""); }} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
      )}
    </section>
  );
}
