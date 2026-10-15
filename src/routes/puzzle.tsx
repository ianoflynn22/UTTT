import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { applyMove, isLegal, type GameState, type Move } from "@/lib/game";
import { dailyPuzzle, dateKey, defenderReply, hintMove } from "@/lib/puzzle";
import { BoardView, markClass } from "@/components/GameBoard";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/use-session";
import { submitPuzzleSolve } from "@/lib/puzzle.functions";
import { flag } from "@/lib/countries";

export const Route = createFileRoute("/puzzle")({
  validateSearch: (s: Record<string, unknown>): { date?: string } =>
    typeof s["date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["date"]) ? { date: s["date"] } : {},
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Daily Ultimate Tic-Tac-Toe Puzzle — UTTT+" },
      {
        name: "description",
        content: "A new Ultimate Tic-Tac-Toe puzzle every day. Beat the defender and win the game in 5+ moves.",
      },
      { property: "og:title", content: "Daily Ultimate Tic-Tac-Toe Puzzle" },
      { property: "og:description", content: "Beat the defender in 5+ moves. New puzzle every day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://utttplus.com/og-image.png" },
      { name: "twitter:image", content: "https://utttplus.com/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://utttplus.com/puzzle" }],
  }),
  component: PuzzlePage,
});

const STORE = "uttt-puzzle-solved";
const HINTED = "uttt-puzzle-hinted";
const BEST = "uttt-puzzle-best";
export const ARCHIVE = "uttt-puzzle-archive";
export const ARCHIVE_START = "2026-10-01";
type Row = { user_id: string; username: string; country: string; current_streak: number; best_streak: number };
type ScoreRow = { user_id: string; username: string; country: string; moves: number; tries: number };

function PuzzlePage() {
  const [key, setKey] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [mine, setMine] = useState<Move[]>([]);
  const [line, setLine] = useState<Move[]>([]);
  const [result, setResult] = useState<"solved" | "wrong" | null>(null);
  const [replying, setReplying] = useState(false);
  const [tries, setTries] = useState(0);
  const [streak, setStreak] = useState(0);
  const [step, setStep] = useState<number | null>(null);
  const [hinted, setHinted] = useState(false);
  const [banked, setBanked] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const user = useUser();
  const qc = useQueryClient();
  const submit = useServerFn(submitPuzzleSolve);
  const { date } = Route.useSearch();
  const [archive, setArchive] = useState(false);

  useEffect(() => {
    const today = dateKey();
    const isPast = !!date && date < today && date >= ARCHIVE_START;
    setArchive(isPast);
    const k = isPast ? date! : today;
    setKey(k);
    setResult(null); setHinted(false); setBanked(false); setBest(null); setMine([]); setLine([]); setStep(null); setLastScore(null); setTries(0);
    const solved: string[] = JSON.parse(localStorage.getItem(STORE) || "[]");
    if (solved.includes(k)) setResult("solved");
    const hintedDays: string[] = JSON.parse(localStorage.getItem(HINTED) || "[]");
    if (hintedDays.includes(k)) setHinted(true);
    if (solved.includes(k)) setBanked(true);
    if (isPast) {
      const done: Record<string, number> = JSON.parse(localStorage.getItem(ARCHIVE) || "{}");
      if (typeof done[k] === "number") { setBest(done[k]!); setBanked(true); }
    }
    const bests: Record<string, number> = JSON.parse(localStorage.getItem(BEST) || "{}");
    if (typeof bests[k] === "number") setBest(bests[k]!);
    let s = 0;
    const d = new Date();
    if (!solved.includes(k)) d.setUTCDate(d.getUTCDate() - 1);
    while (solved.includes(dateKey(d))) {
      s++;
      d.setUTCDate(d.getUTCDate() - 1);
    }
    setStreak(s);
  }, [date]);

  const puzzle = useMemo(() => (key ? dailyPuzzle(key) : null), [key]);
  useEffect(() => {
    if (puzzle) setState(puzzle.start);
  }, [puzzle]);

  // Winning line to replay: the player's own if they just solved it, otherwise the stored solution.
  const replayLine = line.length && result === "solved" ? line : (puzzle?.line ?? []);
  const frames = useMemo(() => {
    if (!puzzle) return [];
    const f = [puzzle.start];
    for (const m of replayLine) f.push(applyMove(f[f.length - 1]!, m));
    return f;
  }, [puzzle, replayLine]);

  if (!puzzle || !state || !key)
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Loading puzzle…</main>;

  const side = puzzle.start.current;
  const reset = () => {
    setState(puzzle.start);
    setMine([]);
    setLine([]);
    setResult(null);
  };
  // Play the same puzzle again to try to win it in fewer moves. The solve and the streak stay banked.
  const retry = () => {
    setStep(null);
    setLastScore(null);
    reset();
  };

  const useHint = () => {
    if (
      !archive &&
      !hinted &&
      !window.confirm("Using a hint ends your current streak, and today won't count towards a new one. Show a hint?")
    )
      return;
    if (archive) setHinted(true);
    else if (!hinted) {
      const h: string[] = JSON.parse(localStorage.getItem(HINTED) || "[]");
      localStorage.setItem(HINTED, JSON.stringify([...h, key]));
      setHinted(true);
      setStreak(0);
    }
    setHint(hintMove(puzzle, state, line));
  };

  const play = (mv: Move) => {
    if (result !== null || replying || !isLegal(state, mv)) return;
    setHint(null);
    const n = applyMove(state, mv);
    const nextMine = [...mine, mv];
    setState(n);
    setMine(nextMine);
    setLine((l) => [...l, mv]);
    if (n.over) {
      if (n.winner !== side) {
        setResult("wrong");
        setTries((t) => t + 1);
        setTimeout(reset, 1400);
        return;
      }
      setResult("solved");
      setStep(null);
      const score = nextMine.length;
      setLastScore(score);
      setBanked(true);
      if (archive) {
        // Archive puzzles are practice: saved on this device only, never streaks or leaderboards.
        const done: Record<string, number> = JSON.parse(localStorage.getItem(ARCHIVE) || "{}");
        if (typeof done[key] !== "number" || score < done[key]!) done[key] = score;
        localStorage.setItem(ARCHIVE, JSON.stringify(done));
        setBest((b) => (b === null ? score : Math.min(b, score)));
        return;
      }
      const bests: Record<string, number> = JSON.parse(localStorage.getItem(BEST) || "{}");
      if (typeof bests[key] !== "number" || score < bests[key]!) {
        bests[key] = score;
        localStorage.setItem(BEST, JSON.stringify(bests));
      }
      setBest((b) => (b === null ? score : Math.min(b, score)));
      track("puzzle_solved", { tries: tries + 1, hinted, moves: score });
      // A hinted day never counts: no saved solve, so the streak stays broken.
      if (hinted) return;
      const solved: string[] = JSON.parse(localStorage.getItem(STORE) || "[]");
      if (!solved.includes(key)) {
        localStorage.setItem(STORE, JSON.stringify([...solved, key]));
        setStreak((x) => x + 1);
      }
      if (user)
        submit({ data: { day: key, moves: nextMine, tries: tries + 1 } })
          .then(() => {
            qc.invalidateQueries({ queryKey: ["puzzle-streaks"] });
            qc.invalidateQueries({ queryKey: ["puzzle-day-scores", key] });
          })
          .catch(() => {});
      return;
    }
    setReplying(true);
    setTimeout(() => {
      const r = defenderReply(n, nextMine.length - 1);
      const k = applyMove(n, r);
      setState(k);
      setLine((l) => [...l, r]);
      setReplying(false);
      if (k.over) {
        setResult("wrong");
        setTries((t) => t + 1);
        setTimeout(reset, 1400);
      }
    }, 500);
  };

  const solved = result === "solved";
  // Sent to one board: point at the square. Free choice: point at the board.
  const freeChoice = state.target === null || state.completed[state.target] !== null;
  const shownStep = step ?? frames.length - 1;
  const shown = solved ? (frames[shownStep] ?? state) : state;

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">{archive ? "Archive puzzle · practice" : "Daily puzzle"} · {key}</p>
        <h1 className="mt-2 font-display text-3xl font-bold">
          <span className={cn(markClass(side))}>{side}</span> to play and win
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Beat the Bot from this position. Par is {puzzle.attackerMoves} moves — can you find a faster win? Lose or draw
          and it resets.{" "}
          {archive ? "Practice only — doesn't affect your streak." : <>Streak: <span className="font-mono text-primary">{streak}</span></>}{" "}
          <Link to="/puzzle/archive" className="underline hover:text-foreground">Past puzzles</Link>
        </p>

        <p className="mt-3 min-h-7 font-display text-lg font-bold" aria-live="polite">
          {solved
            ? `Solved in ${lastScore ?? puzzle.attackerMoves} of your moves.`
            : result === "wrong"
              ? "The Bot held on — try again."
              : replying
                ? "Bot is replying…"
                : mine.length
                  ? `Your moves: ${mine.length}`
                  : banked
                    ? `Playing again — your best is ${best ?? "–"}`
                    : ""}
        </p>
        {solved && (
          <>
            <div className="mb-3 flex items-center justify-center gap-2 font-mono text-sm">
              <button onClick={() => setStep(0)} className="rounded border px-2 py-1" aria-label="First move">
                ⏮
              </button>
              <button
                onClick={() => setStep(Math.max(0, shownStep - 1))}
                className="rounded border px-2 py-1"
                aria-label="Previous move"
              >
                ◀
              </button>
              <span className="min-w-24 text-muted-foreground">
                Move {shownStep} / {frames.length - 1}
              </span>
              <button
                onClick={() => setStep(Math.min(frames.length - 1, shownStep + 1))}
                className="rounded border px-2 py-1"
                aria-label="Next move"
              >
                ▶
              </button>
              <button
                onClick={() => setStep(frames.length - 1)}
                className="rounded border px-2 py-1"
                aria-label="Last move"
              >
                ⏭
              </button>
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-center gap-3 text-sm">
              <span className="font-mono text-muted-foreground">
                Par {puzzle.attackerMoves} · Your best {best ?? lastScore ?? puzzle.attackerMoves}
              </span>
              <button onClick={retry} className="rounded-full border border-primary px-4 py-1.5 font-bold text-primary">
                Try to beat it
              </button>
              <ShareResult
                day={key}
                moves={lastScore ?? puzzle.attackerMoves}
                tries={tries + 1}
                hinted={hinted}
                final={frames[frames.length - 1]!}
              />
            </div>
          </>
        )}
        <BoardView
          state={shown}
          locked={result !== null || replying}
          onPlay={play}
          hintBoard={!solved && hint && freeChoice ? hint.b : null}
          hintCell={!solved && hint && !freeChoice ? hint : null}
        />
        {!solved && !banked && result === null && !replying && (
          <button onClick={useHint} className="mt-3 mr-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
            Hint{hinted ? "" : " (ends streak)"}
          </button>
        )}
        {hinted && !solved && (
          <p className="mt-2 text-xs text-muted-foreground">Hint used — today won't count towards your streak.</p>
        )}
        {hinted && solved && (
          <p className="mt-2 text-xs text-muted-foreground">
            Solved with a hint — today doesn't count towards your streak.
          </p>
        )}
        {!solved && mine.length > 0 && result === null && !replying && (
          <button onClick={reset} className="mt-3 rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
            Restart puzzle
          </button>
        )}
        <TodayScores day={key} signedIn={!!user} />
        <StreakBoard signedIn={!!user} />
        <p className="mt-6">
          <Link to="/" className="rounded-full border px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">
            Play a full game →
          </Link>
        </p>
      </div>
    </main>
  );
}

function shareText(day: string, moves: number, tries: number, hinted: boolean, final: GameState) {
  const grid = [0, 1, 2]
    .map((r) =>
      [0, 1, 2]
        .map((c) => {
          const v = final.completed[r * 3 + c];
          return v === "X" ? "🟥" : v === "O" ? "🟩" : v === "D" ? "⬜" : "⬛";
        })
        .join(""),
    )
    .join("\n");
  return `UTTT+ Daily Puzzle ${day}\nSolved in ${moves} moves · ${tries} ${tries === 1 ? "try" : "tries"}${hinted ? " · hint used" : ""}\n${grid}\nhttps://utttplus.com/puzzle`;
}

function ShareResult({
  day,
  moves,
  tries,
  hinted,
  final,
}: {
  day: string;
  moves: number;
  tries: number;
  hinted: boolean;
  final: GameState;
}) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const user = useUser();
  const { data: isAdmin } = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).some((r) => r.role === "admin");
    },
  });
  const text = shareText(day, moves, tries, hinted, final);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    track("puzzle_share", { day, moves });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <>
      <button
        onClick={copy}
        className="rounded-full border px-4 py-1.5 font-bold text-muted-foreground hover:text-foreground"
      >
        {copied ? "Copied!" : "Share result"}
      </button>
      {isAdmin && (
        <button
          onClick={() => setPreview((p) => !p)}
          className="rounded-full border px-4 py-1.5 text-muted-foreground hover:text-foreground"
        >
          {preview ? "Hide preview" : "Preview result"}
        </button>
      )}
      {isAdmin && preview && (
        <pre className="mx-auto mt-3 max-w-xs whitespace-pre-wrap rounded-xl border bg-card p-3 text-left text-xs">
          {text}
        </pre>
      )}
    </>
  );
}

function TodayScores({ day, signedIn }: { day: string; signedIn: boolean }) {
  const { data } = useQuery({
    queryKey: ["puzzle-day-scores", day],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("puzzle_day_scores", { _day: day });
      if (error) throw error;
      return (data ?? []) as ScoreRow[];
    },
  });
  if (!signedIn) return <NextPuzzleCountdown />;
  const rows = data ?? [];
  return (
    <>
    <NextPuzzleCountdown />
    <section className="mx-auto mt-4 max-w-3xl rounded-xl border bg-card p-4 text-left">
      <h2 className="font-display text-base font-bold">Today's best scores</h2>
      <p className="mt-1 text-xs text-muted-foreground">Fewest of your own moves to win today's puzzle.</p>
      <ol className="mt-3 space-y-1 text-sm">
        {rows.length === 0 && <li className="text-muted-foreground">No scores yet — be the first.</li>}
        {rows.map((r, i) => (
          <li key={r.user_id} className="flex justify-between">
            <span>
              <span className="mr-2 font-mono text-muted-foreground">{i + 1}.</span>
              {flag(r.country)} {r.username}
            </span>
            <span className="font-display font-bold text-primary">{r.moves}</span>
          </li>
        ))}
      </ol>
    </section>
    </>
  );
}

function StreakBoard({ signedIn }: { signedIn: boolean }) {
  const { data } = useQuery({
    queryKey: ["puzzle-streaks"],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("puzzle_streaks");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  if (!signedIn) {
    return (
      <p className="mt-8 text-sm text-muted-foreground">
        <Link to="/auth" className="underline">
          Sign in
        </Link>{" "}
        to save your streak and join the streak leaderboard.
      </p>
    );
  }
  const rows = data ?? [];
  const top = (k: "current_streak" | "best_streak") =>
    [...rows]
      .filter((r) => r[k] > 0)
      .sort((a, b) => b[k] - a[k])
      .slice(0, 10);
  return (
    <section className="mx-auto mt-10 grid max-w-3xl gap-4 text-left sm:grid-cols-2">
      {(
        [
          ["current_streak", "Longest active streak"],
          ["best_streak", "Best streak ever"],
        ] as const
      ).map(([k, title]) => (
        <div key={k} className="rounded-xl border bg-card p-4">
          <h2 className="font-display text-base font-bold">{title}</h2>
          <ol className="mt-3 space-y-1 text-sm">
            {top(k).length === 0 && <li className="text-muted-foreground">No streaks yet — be the first.</li>}
            {top(k).map((r, i) => (
              <li key={r.user_id} className="flex justify-between">
                <span>
                  <span className="mr-2 font-mono text-muted-foreground">{i + 1}.</span>
                  {flag(r.country)} {r.username}
                </span>
                <span className="font-display font-bold text-primary">{r[k]}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

function NextPuzzleCountdown() {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      const s = Math.max(0, Math.floor((next - now.getTime()) / 1000));
      const p = (n: number) => String(n).padStart(2, "0");
      setLeft(`${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="mx-auto mt-10 max-w-3xl text-center font-mono text-sm text-muted-foreground">
      Next puzzle in <span className="font-bold text-foreground">{left ?? "--:--:--"}</span>
    </p>
  );
}
