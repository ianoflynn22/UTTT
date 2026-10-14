import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MODE_INFO, type Mode } from "@/lib/game";
import { flag } from "@/lib/countries";
import { analyzeGame, type GameAnalysis } from "@/lib/analysis.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/history")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Match history — Ultimate Tic-Tac-Toe Plus" },
      { name: "description", content: "Review your finished online games, results and rating changes." },
      { property: "og:title", content: "Match history" },
      { property: "og:description", content: "Review your finished online games, results and rating changes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: History,
});

interface FinishedRow {
  id: string;
  mode: string;
  winner: string | null;
  player_x: string;
  player_o: string | null;
  created_by: string | null;
  elo_delta_x: number | null;
  elo_delta_o: number | null;
  updated_at: string;
  x_profile: { username: string; country: string | null } | null;
  o_profile: { username: string; country: string | null } | null;
}

function History() {
  const user = Route.useRouteContext().user;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [analyses, setAnalyses] = useState<Record<string, GameAnalysis>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<Record<string, string | null>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["history", user.id],
    queryFn: async (): Promise<FinishedRow[]> => {
      const { data: games, error } = await supabase
        .from("games")
        .select(
          "id, mode, winner, player_x, player_o, created_by, elo_delta_x, elo_delta_o, updated_at, x_profile:profiles!games_player_x_fkey(username, country), o_profile:profiles!games_player_o_fkey(username, country)",
        )
        .eq("status", "finished")
        .or(`player_x.eq.${user.id},player_o.eq.${user.id}`)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (games ?? []) as unknown as FinishedRow[];
    },
  });

  const run = async (gameId: string) => {
    setOpen((s) => ({ ...s, [gameId]: true }));
    if (analyses[gameId]) return;
    setBusy((s) => ({ ...s, [gameId]: true }));
    setErr((s) => ({ ...s, [gameId]: null }));
    try {
      const { analysis } = await analyzeGame({ data: { gameId } });
      setAnalyses((s) => ({ ...s, [gameId]: analysis }));
    } catch (e) {
      setErr((s) => ({ ...s, [gameId]: e instanceof Error ? e.message : "Analysis failed" }));
    } finally {
      setBusy((s) => ({ ...s, [gameId]: false }));
    }
  };

  const resultLabel = (winner: string | null, myRole: "X" | "O") =>
    winner === null ? { text: "Draw", cls: "text-muted-foreground" } : winner === myRole ? { text: "Win", cls: "text-player-o" } : { text: "Loss", cls: "text-destructive" };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Match history</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your finished online games, newest first.</p>

      <div className="mt-5 grid gap-2">
        {isLoading ? (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Loading…</p>
        ) : !data?.length ? (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            No finished games yet — <Link to="/online" className="text-primary underline">play online</Link> to build a record.
          </p>
        ) : (
          data.map((g) => {
            const myRole: "X" | "O" = g.player_x === user.id ? "X" : "O";
            const opp = myRole === "X" ? g.o_profile : g.x_profile;
            const oppId = myRole === "X" ? g.player_o : g.player_x;
            const res = resultLabel(g.winner, myRole);
            const rated = g.created_by === null;
            const delta = (myRole === "X" ? g.elo_delta_x : g.elo_delta_o) ?? 0;
            const a = analyses[g.id];
            return (
              <div key={g.id} className="rounded-xl border bg-card">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground sm:hidden">{MODE_INFO[g.mode as Mode]?.name}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {flag(opp?.country ?? null)} {opp?.username ?? "Player"}{" "}
                    <span className="hidden font-mono text-[10px] uppercase text-muted-foreground sm:inline">· {MODE_INFO[g.mode as Mode]?.name}</span>
                  </span>
                  <span className={cn("font-semibold", res.cls)}>{res.text}</span>
                  <span className={cn("w-10 text-right font-semibold tabular-nums", rated && delta > 0 ? "text-player-o" : rated && delta < 0 ? "text-destructive" : "text-muted-foreground")}>
                    {!rated ? "—" : delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "±0"}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {new Date(g.updated_at).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}
                  </span>
                  {oppId && (
                    <Link to="/online/$gameId" params={{ gameId: g.id }} className="rounded-md border px-3 py-1.5 text-xs">
                      Replay
                    </Link>
                  )}
                  <button onClick={() => run(g.id)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                    {a ? "AI tips" : "Analyse"}
                  </button>
                </div>
                {open[g.id] && (
                  <div className="border-t px-4 py-4 text-sm">
                    {busy[g.id] && <p className="text-muted-foreground">Thinking about your game…</p>}
                    {err[g.id] && <p className="text-destructive">{err[g.id]}</p>}
                    {a && (
                      <>
                        <p className="text-foreground">{a.summary}</p>
                        <ul className="mt-3 grid gap-2.5">
                          {a.tips.map((t, i) => (
                            <li key={i} className="grid gap-0.5">
                              <span className="font-semibold text-player-plus">{i + 1}. {t.title}</span>
                              <span className="text-muted-foreground">{t.body}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
