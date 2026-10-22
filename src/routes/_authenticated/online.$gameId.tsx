import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BoardView, markClass } from "@/components/GameBoard";
import { MODE_INFO, replayStates, type GameState, type Move, type Player } from "@/lib/game";
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

  const finished = game.status === "finished" || game.state.over;
  // The match record is the source of truth: a resignation has a winner even though the board doesn't.
  const winner: Player | null = finished ? (game.winner ?? game.state.winner) : null;
  const state = game.state;
  const oppName = game.opponent ? `${flag(game.opponent.country)} ${game.opponent.username}` : "player";
  const waiting = game.status === "waiting";
  if (finished && typeof window !== "undefined" && !trackedGames.has(game.id)) {
    trackedGames.add(game.id);
    track("game_complete", { mode: game.mode, type: "online", result: winner === null ? "draw" : winner === game.myRole ? "win" : "loss" });
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
      ? winner === null
        ? "It's a draw"
        : winner === game.myRole
          ? game.resigned ? `You win — ${oppName} resigned` : "You win!"
          : game.resigned ? "You resigned" : `${oppName} wins`
      : myTurn
        ? "Your move"
        : "Opponent's move…";

  const resultClass = finished && winner ? (winner === game.myRole ? "text-primary" : markClass(winner)) : "";

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
              {winner ? (
                <>
                  <span className={resultClass}>{winner}</span> wins{game.resigned ? " by resignation" : ""}
                </>
              ) : (
                <>Draw</>
              )}
              {" · "}{game.friendGame ? "Unrated friend game" : "Rated"}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </header>

        {finished ? (
          <Replay game={game} winner={winner} />
        ) : (
          <BoardView state={state} locked={locked} onPlay={(mv) => moveMut.mutate(mv)} />
        )}

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

function EloCard({ name, role, before, delta, won }: { name: string; role: Player; before: number | null; delta: number | null; won: boolean }) {
  const after = before !== null && delta !== null ? before + delta : null;
  return (
    <div className={cn("rounded-lg border bg-card px-4 py-3 text-left", won && "border-primary")}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className={cn("font-bold", markClass(role))}>{role}</span> · {won ? "Winner" : "Player"}
      </p>
      <p className="mt-1 truncate font-display font-bold">{name}</p>
      <p className="mt-1 text-sm">
        {before !== null ? <span className="text-muted-foreground">{before} → </span> : null}
        {after !== null ? <span className="font-bold">{after}</span> : null}
        {delta !== null && (
          <span className={cn("ml-2 font-mono text-xs", delta > 0 ? "text-player-o" : delta < 0 ? "text-destructive" : "text-muted-foreground")}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </p>
    </div>
  );
}

function Replay({ game, winner }: { game: Awaited<ReturnType<typeof getGame>>; winner: Player | null }) {
  const states = replayStates(game.mode, game.moves ?? [], game.state);
  const last = states.length - 1;
  const [i, setI] = useState(last);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (i >= last) { setPlaying(false); return; }
    const t = setTimeout(() => setI((n) => Math.min(last, n + 1)), 700);
    return () => clearTimeout(t);
  }, [playing, i, last]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { setPlaying(false); setI((n) => Math.max(0, n - 1)); }
      else if (e.key === "ArrowRight") { setPlaying(false); setI((n) => Math.min(last, n + 1)); }
      else if (e.key === "Home") { setPlaying(false); setI(0); }
      else if (e.key === "End") { setPlaying(false); setI(last); }
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);
  // At the end show the real final board (exact + marks); earlier steps use the rebuilt positions.
  const view: GameState = i === last ? game.state : states[i]!;
  const opp = game.opponent ? `${flag(game.opponent.country)} ${game.opponent.username}` : "Opponent";
  const me = game.myName ?? "You";
  const xName = game.myRole === "X" ? me : opp;
  const oName = game.myRole === "O" ? me : opp;
  const e = game.elo;
  const btn = "rounded-md border bg-card px-3 py-2 text-sm disabled:opacity-40";
  return (
    <>
      <div className="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-3">
        <EloCard name={xName} role="X" before={game.friendGame ? null : e?.xBefore ?? null} delta={game.friendGame ? null : e?.xDelta ?? null} won={winner === "X"} />
        <EloCard name={oName} role="O" before={game.friendGame ? null : e?.oBefore ?? null} delta={game.friendGame ? null : e?.oDelta ?? null} won={winner === "O"} />
      </div>
      <div className="mx-auto mt-4 flex max-w-xl flex-wrap items-center justify-center gap-2">
        <span className="rounded-full bg-primary/15 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">Replay</span>
        <button className={btn} onClick={() => { setPlaying(false); setI(0); }} disabled={i === 0} aria-label="First move">⏮</button>
        <button className={btn} onClick={() => { setPlaying(false); setI(Math.max(0, i - 1)); }} disabled={i === 0} aria-label="Previous move">◀</button>
        <button className={btn} onClick={() => { if (i >= last) setI(0); setPlaying((p) => !p); }} disabled={last === 0} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
        <button className={btn} onClick={() => { setPlaying(false); setI(Math.min(last, i + 1)); }} disabled={i === last} aria-label="Next move">▶▶</button>
        <button className={btn} onClick={() => { setPlaying(false); setI(last); }} disabled={i === last} aria-label="Last move">⏭</button>
        <span className="font-mono text-xs text-muted-foreground">Move {i}/{last}</span>
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">Use ← → keys to step through moves</p>
      <BoardView state={view} locked onPlay={() => {}} hintBoard={view.over ? null : view.target} />
    </>
  );
}
