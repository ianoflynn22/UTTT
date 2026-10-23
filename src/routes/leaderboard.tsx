import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/use-session";
import { MODE_INFO, type Mode } from "@/lib/game";
import { flag } from "@/lib/countries";
import { Wld } from "@/components/rating-bits";
import { cn } from "@/lib/utils";
import { getWeeklyLeaderboard } from "@/lib/weekly.functions";

export const Route = createFileRoute("/leaderboard")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Leaderboard — Ultimate Tic-Tac-Toe Plus" },
      { name: "description", content: "Top-rated players in every Tic-Tac-Toe mode." },
      { property: "og:title", content: "Leaderboard — Ultimate Tic-Tac-Toe Plus" },
      { property: "og:description", content: "Top-rated players in every mode." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Leaderboard,
});

type Rating = { mode: string; elo: number; wins: number; losses: number; draws: number; games: number };
type Rel = { status: string; requester_id: string };

function Leaderboard() {
  const [mode, setMode] = useState<Mode>("ultimate");
  const [period, setPeriod] = useState<"all" | "week">("all");
  const [open, setOpen] = useState<string | null>(null);
  const me = useUser();
  const weekly = useQuery({
    queryKey: ["leaderboard-week", mode],
    enabled: period === "week",
    queryFn: () => getWeeklyLeaderboard({ data: { mode } }),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ratings")
        .select("elo, wins, losses, draws, games, profiles(id, username, country)")
        .eq("mode", mode)
        .order("elo", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Leaderboard</h1>
      <div className="mt-4 inline-flex rounded-full border bg-card p-1">
        {(["all", "week"] as const).map((p) => (
          <button key={p} onClick={() => setPeriod(p)} className={cn("rounded-full px-3 py-1 text-sm", p === period ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {p === "all" ? "All-time" : "This week"}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(MODE_INFO) as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cn("rounded-full border px-3 py-1 text-sm", m === mode ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>
            {MODE_INFO[m].name}
          </button>
        ))}
      </div>
      {period === "week" ? (
        <>
          <div className="mt-5 overflow-hidden rounded-xl border bg-card">
            {weekly.isLoading ? (
              <p className="p-5 text-sm text-muted-foreground">Loading…</p>
            ) : !weekly.data?.length ? (
              <p className="p-5 text-sm text-muted-foreground">No rated games this week yet — climb to the top!</p>
            ) : (
              weekly.data.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
                  <span className="w-6 font-mono text-sm text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 font-medium">{flag(r.country)} {r.username}{me?.id === r.id && <span className="ml-2 font-mono text-xs text-muted-foreground">(you)</span>}</span>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{r.wins}W · {r.games} games</span>
                  <span className={cn("w-14 text-right text-sm font-semibold tabular-nums", r.gain >= 0 ? "text-primary" : "text-destructive")}>{r.gain > 0 ? "+" : ""}{r.gain}</span>
                </div>
              ))
            )}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Rating gained in rated games since Monday 00:00 UTC. Resets every week.</p>
        </>
      ) : (
      <>
      <div className="mt-5 overflow-hidden rounded-xl border bg-card">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : !data?.length ? (
          <p className="p-5 text-sm text-muted-foreground">No players yet — be the first!</p>
        ) : (
          data.map((r, i) => {
            const pid = r.profiles?.id;
            const name = r.profiles?.username ?? "player";
            const isMe = !!me && me.id === pid;
            const expanded = open === pid;
            return (
              <div key={i} className="border-b last:border-0">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="w-6 font-mono text-sm text-muted-foreground">{i + 1}</span>
                  <button
                    onClick={() => setOpen(expanded ? null : (pid ?? null))}
                    aria-expanded={expanded}
                    className="flex-1 text-left font-medium underline-offset-4 hover:underline"
                  >
                    {flag(r.profiles?.country)} {name}
                  </button>
                  <span className="hidden sm:inline"><Wld w={r.wins} l={r.losses} d={r.draws} /></span>
                  <span className="w-14 text-right text-sm font-semibold tabular-nums text-primary">{r.elo}</span>
                </div>
                {expanded && pid && <PlayerCard userId={pid} username={name} country={r.profiles?.country ?? null} isMe={isMe} />}
              </div>
            );
          })
        )}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Tap a name to see their record and add them as a friend.</p>
      </>
      )}
    </main>
  );
}

/** A player's record and the friend actions you can take on them, opened from a leaderboard row. */
function PlayerCard({ userId, username, country, isMe }: { userId: string; username: string; country: string | null; isMe: boolean }) {
  const me = useUser();
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["player-stats", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ratings")
        .select("mode, elo, wins, losses, draws, games")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as Rating[];
    },
  });

  const { data: rel } = useQuery({
    queryKey: ["friend-rel", me?.id, userId],
    enabled: !!me,
    queryFn: async () => {
      if (!me) return null;
      const { data, error } = await supabase
        .from("friendships")
        .select("status, requester_id")
        .or(`and(requester_id.eq.${me.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${me.id})`)
        .limit(1);
      if (error) return null;
      return ((data ?? [])[0] ?? null) as Rel | null;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["friend-rel", me?.id, userId] });
    if (me) qc.invalidateQueries({ queryKey: ["friendships", me.id] });
  };

  const send = async () => {
    if (!me) return;
    setNote(null);
    const { error } = await supabase.from("friendships").insert({ requester_id: me.id, addressee_id: userId });
    if (error) setNote("Couldn't send that request.");
    refresh();
  };

  const accept = async () => {
    if (!me) return;
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("requester_id", userId).eq("addressee_id", me.id);
    if (error) setNote("Couldn't accept that request.");
    refresh();
  };

  const status = rel?.status;
  const fromMe = rel?.requester_id === me?.id;

  return (
    <div className="border-t bg-background/40 px-4 py-4">
      <h2 className="font-display text-sm font-bold">
        {flag(country)} {username}
        {isMe && <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">(you)</span>}
      </h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="font-mono text-[10px] uppercase text-muted-foreground">
            <th className="text-left font-normal">Mode</th>
            <th className="text-right font-normal">Rating</th>
            <th className="text-right font-normal">W D L</th>
            <th className="text-right font-normal">Games</th>
          </tr>
        </thead>
        <tbody>
          {(stats ?? []).map((s) => (
            <tr key={s.mode} className="border-t border-border/50">
              <td className="py-1">{MODE_INFO[s.mode as Mode]?.name ?? s.mode}</td>
              <td className="text-right font-semibold tabular-nums text-primary">{s.elo}</td>
              <td className="text-right"><Wld w={s.wins} l={s.losses} d={s.draws} /></td>
              <td className="text-right tabular-nums text-muted-foreground">{s.games}</td>
            </tr>
          ))}
          {!stats?.length && <tr><td colSpan={4} className="py-2 text-muted-foreground">No rated games yet.</td></tr>}
        </tbody>
      </table>

      {!me && (
        <p className="mt-3 text-sm text-muted-foreground">
          <a href="/auth" className="text-primary underline">Sign in</a> to add {username} as a friend.
        </p>
      )}

      {me && !isMe && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {status === "accepted" && <span className="text-sm text-muted-foreground">You're friends.</span>}
          {status === "pending" && fromMe && <span className="text-sm text-muted-foreground">Request sent — waiting for {username} to accept.</span>}
          {status === "pending" && !fromMe && (
            <button onClick={accept} className="rounded-md bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground">
              Accept {username}'s request
            </button>
          )}
          {status === "blocked" && <span className="text-sm text-muted-foreground">You blocked this player.</span>}
          {!status && (
            <button onClick={send} className="rounded-md border border-primary px-3 py-1.5 text-sm font-bold text-primary">
              Add friend
            </button>
          )}
          {note && <span className="text-sm text-destructive">{note}</span>}
        </div>
      )}
    </div>
  );
}
