import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { findMatch, leaveQueue, listActiveGames } from "@/lib/online-api";
import { MODE_INFO, type Mode } from "@/lib/game";
import { flag } from "@/lib/countries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/online/")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Play online — Ultimate Tic-Tac-Toe Plus" },
      { name: "description", content: "Find an opponent and play Ultimate Tic-Tac-Toe online with live Elo ratings." },
      { property: "og:title", content: "Play online — Ultimate Tic-Tac-Toe Plus" },
      { property: "og:description", content: "Find an opponent and play online with live Elo ratings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnlinePage,
});

function OnlinePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("ultimate");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const findMatchFn = useServerFn(findMatch);
  const leaveQueueFn = useServerFn(leaveQueue);
  const listGamesFn = useServerFn(listActiveGames);

  const { data: games } = useQuery({
    queryKey: ["online-active-games"],
    queryFn: () => listGamesFn(),
    refetchInterval: 4000,
  });

  // If we got matched while waiting, jump straight into the game.
  useEffect(() => {
    if (!games) return;
    const active = games.find((g) => g.status === "active");
    if (active && searching) {
      setSearching(false);
      navigate({ to: "/online/$gameId", params: { gameId: active.id } });
    }
  }, [games, searching, navigate]);

  const start = async () => {
    setError(null);
    const res = await findMatchFn({ data: { mode } });
    track("game_start", { mode, type: "online" });
    if (res.gameId) {
      navigate({ to: "/online/$gameId", params: { gameId: res.gameId } });
    } else {
      setSearching(true);
    }
  };

  const cancel = async () => {
    setSearching(false);
    await leaveQueueFn();
  };

  const respond = async (gameId: string, accept: boolean) => {
    await supabase.rpc("respond_challenge", { _game_id: gameId, _accept: accept });
    qc.invalidateQueries({ queryKey: ["online-active-games"] });
    if (accept) navigate({ to: "/online/$gameId", params: { gameId } });
  };

  const all = games ?? [];
  const challenges = all.filter((g) => g.status === "waiting");
  const active = all.filter((g) => g.status === "active");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Play online</h1>
      <p className="mt-1 text-sm text-muted-foreground">Matchmaking games are rated — your Elo updates per mode. Friend challenges are just for fun.</p>

      <section className="mt-6 rounded-xl border bg-card p-5">
        <p className="font-mono text-xs uppercase text-muted-foreground">Mode</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(MODE_INFO) as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={searching}
              title={searching ? "Cancel the search to change mode" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                m === mode ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                searching && "cursor-not-allowed opacity-40",
              )}
            >
              {MODE_INFO[m].name}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={start} disabled={searching} className="rounded-md bg-primary px-5 py-2 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            Find opponent
          </button>
          {searching && (
            <>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="size-2 animate-pulse rounded-full bg-primary" /> Searching…
              </span>
              <button onClick={cancel} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
            </>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </section>

      {challenges.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xl font-bold">Friend challenges</h2>
          <div className="mt-2 grid gap-2">
            {challenges.map((g) => {
              const fromMe = g.createdByMe;
              const name = g.opponent ? `${flag(g.opponent.country)} ${g.opponent.username}` : "a player";
              return (
                <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 text-sm">
                  <span className="flex-1">
                    <span className="font-medium">{fromMe ? name : `Challenge from ${name}`}</span>
                    <span className="text-muted-foreground"> · {MODE_INFO[g.mode].name}</span>
                  </span>
                  {fromMe ? (
                    <button onClick={() => respond(g.id, false)} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
                  ) : (
                    <>
                      <button onClick={() => respond(g.id, true)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground">Accept</button>
                      <button onClick={() => respond(g.id, false)} className="rounded-md border px-3 py-1.5 text-sm">Decline</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xl font-bold">Your games</h2>
          <div className="mt-2 grid gap-2">
            {active.map((g) => (
              <Link key={g.id} to="/online/$gameId" params={{ gameId: g.id }} className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm hover:bg-accent">
                <span className="flex-1">{MODE_INFO[g.mode].name} vs {g.opponent ? `${flag(g.opponent.country)} ${g.opponent.username}` : "player"}</span>
                <span className={cn("font-mono text-xs uppercase", g.state.current === g.myRole ? "text-primary" : "text-muted-foreground")}>
                  {g.state.current === g.myRole ? "Your turn" : "Their turn"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-sm text-muted-foreground">
        Want to play someone you know? <Link to="/friends" className="text-primary underline">Add friends and challenge them →</Link>
      </p>
    </main>
  );
}
