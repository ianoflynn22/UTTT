import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BoardView, markClass } from "@/components/GameBoard";
import { MODE_INFO, type Move } from "@/lib/game";
import { flag } from "@/lib/countries";
import { getGame, makeMove, resign } from "@/lib/online-api";
import { GameAdLayout } from "@/components/AdBanner";
import { track } from "@/lib/analytics";
const trackedGames = new Set<string>();
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/online/$gameId")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Online game — Ultimate Tic-Tac-Toe Plus" },
      { name: "description", content: "Play a live rated online game of Ultimate Tic-Tac-Toe." },
      { property: "og:title", content: "Online game — Ultimate Tic-Tac-Toe Plus" },
      { property: "og:description", content: "Play a live rated online game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnlineGame,
});

function OnlineGame() {
  const { gameId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [newElo, setNewElo] = useState<number | null>(null);
  const fetchGame = useServerFn(getGame);
  const playMoveFn = useServerFn(makeMove);
  const resignFn = useServerFn(resign);

  const { data: game, isLoading, error: loadError } = useQuery({
    queryKey: ["online-game", gameId],
    queryFn: () => fetchGame({ data: { gameId } }),
    refetchInterval: 4000,
    retry: false,
  });

  // Live updates: the board refreshes the moment your opponent moves.
  useEffect(() => {
    if (!gameId) return;
    const channel = supabase
      .channel(`game:${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => {
        qc.invalidateQueries({ queryKey: ["online-game", gameId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, qc]);

  const moveMut = useMutation({
    mutationFn: (mv: Move) => playMoveFn({ data: { gameId, move: mv } }),
    onSuccess: (res) => {
      setError(null);
      if (res.elos && game) setNewElo(game.myRole === "X" ? res.elos.x : res.elos.o);
      qc.invalidateQueries({ queryKey: ["online-game", gameId] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const respond = async (accept: boolean) => {
    setError(null);
    const { error: rpcErr } = await supabase.rpc("respond_challenge", { _game_id: gameId, _accept: accept });
    if (rpcErr) return setError(rpcErr.message);
    qc.invalidateQueries({ queryKey: ["online-game", gameId] });
    qc.invalidateQueries({ queryKey: ["online-active-games"] });
    if (!accept) navigate({ to: "/online" });
  };

  const isLobby = !!game && game.status === "waiting" && game.createdByMe && !game.opponent;
  // Keep the lobby alive while the host is on this page; leaving closes it.
  useEffect(() => {
    if (!isLobby) return;
    const beat = () => { void supabase.rpc("lobby_heartbeat", { _game_id: gameId }); };
    beat();
    const t = setInterval(beat, 20000);
    const close = () => { void supabase.rpc("respond_challenge", { _game_id: gameId, _accept: false }); };
    window.addEventListener("pagehide", close);
    return () => { clearInterval(t); window.removeEventListener("pagehide", close); close(); };
  }, [isLobby, gameId]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading game…</p>
      </main>
    );
  }
  if (loadError || !game) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Game not found.</p>
        <Link to="/online" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          Back to lobby
        </Link>
      </main>
    );
  }

  const state = game.state;
  const oppName = game.opponent ? `${flag(game.opponent.country)} ${game.opponent.username}` : "player";
  const waiting = game.status === "waiting";
  const finished = game.status === "finished" || state.over;
  if (finished && typeof window !== "undefined" && !trackedGames.has(game.id)) {
    trackedGames.add(game.id);
    track("game_complete", { mode: game.mode, type: "online", result: state.winner === null ? "draw" : state.winner === game.myRole ? "win" : "loss" });
  }
  const myTurn = !waiting && !finished && state.current === game.myRole;
  const locked = waiting || finished || !myTurn || moveMut.isPending;

  const status = waiting
    ? isLobby
      ? "Waiting for someone to join…"
      : game.createdByMe
      ? `Waiting for ${oppName} to accept your challenge…`
      : `${oppName} has challenged you!`
    : finished
      ? state.winner === null
        ? "It's a draw"
        : state.winner === game.myRole
          ? "You win!"
          : `${oppName} wins`
      : myTurn
        ? "Your move"
        : "Opponent's move…";

  const resultClass = finished && state.winner ? (state.winner === game.myRole ? "text-primary" : markClass(state.winner)) : "";

  return (
    <main className="min-h-[calc(100vh-57px)] px-4 py-8">
      <GameAdLayout>
      <div className="mx-auto max-w-5xl">
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">{MODE_INFO[game.mode].name} · Online</p>
          <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{status}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You play as{" "}
            <span className={cn("font-bold", markClass(game.myRole))}>{game.myRole}</span>
            {game.opponent && <> · {flag(game.opponent.country)} {game.opponent.username} ({game.opponent.elo})</>}
            {" · You: "}
            <span className="font-mono text-primary">{newElo ?? game.myElo}</span>
          </p>
          {waiting && (
            <div className="mt-3 flex justify-center gap-2">
              {isLobby ? (
                <LobbyShare onCancel={() => respond(false)} />
              ) : game.createdByMe ? (
                <button onClick={() => respond(false)} className="rounded-md border px-4 py-2 text-sm">Cancel challenge</button>
              ) : (
                <>
                  <button onClick={() => respond(true)} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Accept</button>
                  <button onClick={() => respond(false)} className="rounded-md border px-4 py-2 text-sm">Decline</button>
                </>
              )}
            </div>
          )}
          {finished && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-mono text-xs uppercase text-muted-foreground">
              {state.winner ? (
                <>
                  <span className={resultClass}>{state.winner}</span> wins · {newElo ? `new rating ${newElo}` : "rating updated"}
                </>
              ) : (
                <>Draw · {newElo ? `new rating ${newElo}` : "rating updated"}</>
              )}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </header>

        <BoardView state={state} locked={locked} onPlay={(mv) => moveMut.mutate(mv)} />

        <div className="mt-6 flex justify-center gap-3">
          {waiting && !game.createdByMe && null}
          {game.status === "active" && (
            <button
              onClick={() => {
                if (window.confirm("Resign this game? It counts as a loss.")) {
                  resignFn({ data: { gameId } })
                    .then((res) => {
                      if (res.elos) setNewElo(game.myRole === "X" ? res.elos.x : res.elos.o);
                      qc.invalidateQueries({ queryKey: ["online-game", gameId] });
                      qc.invalidateQueries({ queryKey: ["profile"] });
                      qc.invalidateQueries({ queryKey: ["leaderboard"] });
                    })
                    .catch((e: Error) => setError(e.message));
                }
              }}
              className="rounded-md border px-4 py-2 text-sm text-muted-foreground hover:text-destructive"
            >
              Resign
            </button>
          )}
          {game.friendGame && (game.status === "active" || (game.status === "waiting" && !isLobby)) && (
            <button
              onClick={async () => {
                if (!window.confirm("Delete this game? It disappears for both players.")) return;
                const { error } = await supabase.rpc("delete_friend_game", { _game_id: gameId });
                if (error) return setError("Couldn't delete this game.");
                navigate({ to: "/friends" });
              }}
              className="rounded-md border px-4 py-2 text-sm text-muted-foreground hover:text-destructive"
            >
              Delete game
            </button>
          )}
          {finished && game.opponent && (
            <button
              onClick={async () => {
                setError(null);
                const { data: gid, error: rErr } = await supabase.rpc("rematch_opponent", { _game_id: gameId });
                if (rErr || !gid) return setError("Couldn't start a rematch — you may already have a game open with this player.");
                track("challenge_send", { mode: game.mode, type: "rematch" });
                navigate({ to: "/online/$gameId", params: { gameId: gid as string } });
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Rematch
            </button>
          )}
          <Link to="/online" className="rounded-md border bg-card px-4 py-2 text-sm">Back to lobby</Link>
        </div>
      </div>
      </GameAdLayout>
    </main>
  );
}

function LobbyShare({ onCancel }: { onCancel: () => void }) {
  const [copied, setCopied] = useState(false);
  const { data: name } = useQuery({
    queryKey: ["my-username"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase.from("profiles").select("username").eq("id", u.user.id).single();
      return p?.username ?? null;
    },
  });
  if (!name) return null;
  const url = `${window.location.origin}/c/${encodeURIComponent(name)}`;
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Play me at UTTT+", text: `${name} challenges you to Ultimate Tic-Tac-Toe!`, url }); return; } catch { /* fall back to copy */ }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <code className="rounded border px-2 py-1 font-mono text-xs">{url}</code>
      <p className="text-xs text-muted-foreground">Stay on this page — the link stops working if you leave.</p>
      <div className="flex gap-2">
        <button onClick={share} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">{copied ? "Copied!" : "Share link"}</button>
        <button onClick={onCancel} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
      </div>
    </div>
  );
}
