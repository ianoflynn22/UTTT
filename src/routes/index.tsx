import { createFileRoute, Link } from "@tanstack/react-router";
import { track } from "@/lib/analytics";
import { useEffect, useState } from "react";
import { applyMove, MODE_INFO, newGame, type GameState, type Mode, type Move } from "@/lib/game";
import { chooseMove, type Difficulty } from "@/lib/ai";
import { BoardView } from "@/components/GameBoard";
import { GameAdLayout } from "@/components/AdBanner";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Ultimate Tic-Tac-Toe Plus — Play online & vs computer" },
      { name: "description", content: "Play Tic-Tac-Toe, Ultimate and the wild Plus variants with a friend or against easy, medium and hard computer opponents." },
      { property: "og:title", content: "Ultimate Tic-Tac-Toe Plus" },
      { property: "og:description", content: "Ultimate Tic-Tac-Toe with chaotic + tiles. Play a friend or the computer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://utttplus.com/og-image.png" },
      { name: "twitter:image", content: "https://utttplus.com/og-image.png" },
    ],
  }),
  component: Index,
});

type Opponent = "friend" | Difficulty;

function Index() {
  const [mode, setMode] = useState<Mode>("ultimate");
  const [opponent, setOpponent] = useState<Opponent>("medium");
  const [state, setState] = useState<GameState>(() => newGame("ultimate"));
  const [thinking, setThinking] = useState(false);
  const cpuTurn = opponent !== "friend" && state.current === "O" && !state.over;

  const start = (m: Mode = mode) => {
    setMode(m);
    setState(newGame(m));
    track("game_start", { mode: m, type: "offline" });
  };

  const play = (mv: Move) => {
    if (cpuTurn || thinking) return;
    setState((s) => { const n = applyMove(s, mv); if (n.over && !s.over) track("game_complete", { mode: n.mode, type: "offline" }); return n; });
  };

  useEffect(() => {
    if (!cpuTurn) return;
    setThinking(true);
    const t = setTimeout(() => {
      const mv = chooseMove(state, opponent as Difficulty);
      if (mv) setState((s) => (s === state ? applyMove(s, mv) : s));
      setThinking(false);
    }, 350);
    return () => {
      clearTimeout(t);
      setThinking(false);
    };
  }, [cpuTurn, state, opponent]);

  const locked = cpuTurn || thinking;
  const status = state.over
    ? state.winner
      ? opponent !== "friend"
        ? state.winner === "X" ? "You win!" : "Bot wins"
        : `Player ${state.winner} wins!`
      : "It's a draw"
    : cpuTurn
      ? "Bot is thinking…"
      : opponent !== "friend" ? "Your move (X)" : `Player ${state.current} to move`;

  const sub = !state.over && state.ultimate
    ? state.target !== null && state.completed[state.target] === null
      ? `Must play in board ${state.target + 1}`
      : "Play on any open board"
    : null;

  return (
    <main className="min-h-screen px-4 py-8 font-sans">
      <GameAdLayout>
      <div className="mx-auto max-w-5xl">
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">X · O · +</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Ultimate Tic-Tac-Toe <span className="text-player-plus">Plus</span>
          </h1>
        </header>

        <section className="mt-8 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1 text-sm">
            <span className="font-mono text-xs uppercase text-muted-foreground">Mode</span>
            <select value={mode} onChange={(e) => start(e.target.value as Mode)} className="rounded-md border bg-background p-2">
              {(Object.keys(MODE_INFO) as Mode[]).map((m) => <option key={m} value={m}>{MODE_INFO[m].name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-mono text-xs uppercase text-muted-foreground">Opponent</span>
            <select value={opponent} onChange={(e) => { setOpponent(e.target.value as Opponent); setState(newGame(mode)); }} className="rounded-md border bg-background p-2">
              <option value="friend">Pass and Play</option>
              <option value="easy">Bot · Easy</option>
              <option value="medium">Bot · Medium</option>
              <option value="hard">Bot · Hard</option>
            </select>
          </label>
          <button type="button" onClick={() => start()} className="self-end rounded-md bg-primary px-5 py-2 font-bold text-primary-foreground hover:bg-primary/90">
            New game
          </button>
        </section>

        <div className="mt-4 text-center" aria-live="polite">
          <p className="font-display text-xl font-bold">{status}</p>
          {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
          <p className="mt-3">
            <Link to="/online" className="rounded-full border px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              Play online for a rating →
            </Link>{" "}
            <Link to="/puzzle" className="rounded-full border px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              Today's puzzle →
            </Link>
          </p>
        </div>

        <BoardView state={state} locked={locked} onPlay={play} />

        <section className="mx-auto mt-8 max-w-2xl rounded-xl border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
          <h2 className="mb-2 font-display text-base font-bold text-foreground">How to play · {MODE_INFO[mode].name}</h2>
          {MODE_INFO[mode].rules}
        </section>
      </div>
      </GameAdLayout>
    </main>
  );
}
