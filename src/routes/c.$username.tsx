import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/use-session";
import { MODE_INFO, type Mode } from "@/lib/game";
import { track } from "@/lib/analytics";


export const Route = createFileRoute("/c/$username")({
  staticData: { sitemap: false },
  head: ({ params }) => ({
    meta: [
      { title: `${params.username} challenges you — UTTT+` },
      { name: "description", content: `${params.username} challenged you to a game of Ultimate Tic-Tac-Toe Plus. Accept and play online.` },
      { property: "og:title", content: `${params.username} challenges you to UTTT+` },
      { property: "og:description", content: `Tap to accept ${params.username}'s challenge and play Ultimate Tic-Tac-Toe Plus online.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://utttplus.com/og-image.png" },
      { name: "twitter:image", content: "https://utttplus.com/og-image.png" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

export const NEXT_KEY = "uttt-next";

function InvitePage() {
  const { username } = Route.useParams();
  const user = useUser();
  const navigate = useNavigate();
  const [lobby, setLobby] = useState<{ game_id: string; mode: string } | null | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // An open lobby only exists while the host is waiting on the game page; otherwise send visitors home.
  useEffect(() => {
    supabase.rpc("open_lobby", { _username: username }).then(({ data }) => {
      const row = data?.[0] ?? null;
      setLobby(row);
      if (!row) navigate({ to: "/", replace: true });
    });
  }, [username, navigate]);

  const join = async () => {
    if (!lobby) return;
    setBusy(true);
    setMsg(null);
    const { data: gid, error } = await supabase.rpc("join_lobby", { _game_id: lobby.game_id });
    setBusy(false);
    if (error) {
      if (error.message.includes("SELF")) return setMsg("This is your own game link — share it with a friend!");
      return navigate({ to: "/", replace: true });
    }
    track("challenge_send", { mode: lobby.mode, via: "link" });
    if (gid) navigate({ to: "/online/$gameId", params: { gameId: gid } });
  };

  if (!lobby) return <main className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">Looking for {username}'s game…</main>;

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Challenge</p>
      <h1 className="mt-2 font-display text-3xl font-bold">{username} wants to play</h1>
      <p className="mt-2 text-muted-foreground">{MODE_INFO[lobby.mode as Mode]?.name ?? lobby.mode} · rated · {username} is waiting in the lobby now.</p>
      {user ? (
        <button disabled={busy} onClick={join} className="mt-6 w-full rounded-md bg-primary py-2 font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "Joining…" : "Accept and play"}
        </button>
      ) : (
        <Link to="/auth" onClick={() => sessionStorage.setItem(NEXT_KEY, window.location.pathname)} className="mt-6 block w-full rounded-md bg-primary py-2 font-medium text-primary-foreground">
          Sign in to accept
        </Link>
      )}
      {msg && <p className="mt-3 text-sm text-destructive">{msg}</p>}
      <Link to="/how-to-play" className="mt-6 inline-block text-sm text-muted-foreground underline">New to the game? How to play</Link>
    </main>
  );
}
