import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Eye } from "lucide-react";
import { BoardView } from "@/components/GameBoard";
import { Button } from "@/components/ui/button";
import { watchGame } from "@/lib/friend-activity.functions";
import { MODE_INFO } from "@/lib/game";
import { flag } from "@/lib/countries";

export const Route = createFileRoute("/_authenticated/watch/$gameId")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Watch a friend’s game · UTTT+" },
    { name: "description", content: "Watch your friends play live Ultimate Tic-Tac-Toe Plus." },
    { property: "og:title", content: "Watch a friend’s game · UTTT+" },
    { property: "og:description", content: "Watch your friends play live Ultimate Tic-Tac-Toe Plus." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: WatchPage,
});

function WatchPage() {
  const { gameId } = Route.useParams();
  const game = useQuery({
    queryKey: ["watch-game", gameId],
    queryFn: () => watchGame({ data: { gameId } }),
    refetchInterval: (query) => query.state.data?.status === "finished" ? false : 2000,
    retry: false,
  });
  const g = game.data;
  return <main className="mx-auto max-w-3xl px-4 py-8">
    <Button asChild variant="ghost" className="mb-5"><Link to="/friends"><ArrowLeft />Friends</Link></Button>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Eye />Watching{g ? ` · ${MODE_INFO[g.mode].name}` : ""}</h1>
      {g && <span className="font-mono text-xs text-player-o">{g.status === "finished" ? "Finished" : "Live"}</span>}
    </header>
    {game.isPending && <p className="mt-6 text-muted-foreground">Loading game…</p>}
    {game.isError ? <div className="mt-6 space-y-3" role="alert">
      <p className="text-muted-foreground">This game is no longer available to watch.</p>
      <Button variant="outline" onClick={() => game.refetch()}><RefreshCw />Try again</Button>
    </div> : g && <>
      <div className="mt-5 grid grid-cols-2 gap-4 border-y py-4 text-sm">
        <p className="min-w-0 break-words"><span className="mr-2 font-display font-bold text-player-x">X</span>{flag(g.xCountry)} {g.xName}</p>
        <p className="min-w-0 break-words text-right"><span className="mr-2 font-display font-bold text-player-o">O</span>{flag(g.oCountry)} {g.oName}</p>
      </div>
      <p className="mt-5 text-center font-display text-xl font-bold" aria-live="polite">
        {g.status === "finished" ? g.winner ? `${g.winner === "X" ? g.xName : g.oName} wins${g.state.winner !== g.winner ? " — by resignation" : ""}` : "Draw" : `${g.state.current === "X" ? g.xName : g.oName} to move`}
      </p>
      <BoardView state={g.state} locked onPlay={() => {}} hintBoard={g.status === "active" ? g.state.target : null} />
    </>}
  </main>;
}