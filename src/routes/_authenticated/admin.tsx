import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/use-session";
import { getAdminStats, type AdminStats } from "@/lib/admin.functions";
import { MODE_INFO, type Mode } from "@/lib/game";

const MODE_IDS: Mode[] = ["ttt", "tttplus", "ultimate", "ultimateplus"];

export const Route = createFileRoute("/_authenticated/admin")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Site stats · UTTT+" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});


function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums text-primary">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function AdminPage() {
  const user = useUser();
  const admin = useIsAdmin(user?.id);
  const stats = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    enabled: admin.data === true,
    queryFn: () => getAdminStats(),
    refetchInterval: 30_000,
  });

  if (!user || admin.isLoading) {
    return <div className="mx-auto max-w-4xl px-4 py-10 text-muted-foreground">Loading…</div>;
  }
  if (admin.data !== true) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-2xl font-bold">Not available</h1>
        <p className="mt-2 text-muted-foreground">This page is only visible to the site owner.</p>
        <Link to="/" className="mt-4 inline-block text-primary underline">Back to play</Link>
      </div>
    );
  }

  const s = stats.data;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-2xl font-bold">Site stats</h1>
      <p className="mt-1 text-sm text-muted-foreground">Private dashboard — only you can see this. Refreshes every 30 seconds.</p>

      {stats.isLoading || !s ? (
        <p className="mt-6 text-muted-foreground">Loading stats…</p>
      ) : (
        <>
          <h2 className="mt-8 font-mono text-xs uppercase tracking-wider text-muted-foreground">Players</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total players" value={s.total_players} />
            <Stat label="Signups · 7 days" value={s.signups_7d} />
            <Stat label="Signups · 30 days" value={s.signups_30d} />
            <Stat label="Active players · 7 days" value={s.active_players_7d} sub="played an online game" />
          </div>

          <h2 className="mt-8 font-mono text-xs uppercase tracking-wider text-muted-foreground">Games</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total games" value={s.games_total} />
            <Stat label="Finished" value={s.games_finished} />
            <Stat label="In progress" value={s.games_active} />
            <Stat label="Started · 7 days" value={s.games_7d} />
          </div>

          <h2 className="mt-8 font-mono text-xs uppercase tracking-wider text-muted-foreground">Per mode</h2>
          <div className="mt-3 overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-card/60 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Mode</th>
                  <th className="px-4 py-2 text-right font-medium">Games</th>
                  <th className="px-4 py-2 text-right font-medium">Finished</th>
                </tr>
              </thead>
              <tbody>
                {MODE_IDS.map((id) => (
                  <tr key={id} className="border-b last:border-0">
                    <td className="px-4 py-2">{MODE_INFO[id].name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.games_by_mode[id] ?? 0}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.finished_by_mode[id] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-8 font-mono text-xs uppercase tracking-wider text-muted-foreground">Retention</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Came back next day"
              value={s.retention.players_older_7d > 0
                ? `${Math.round((s.retention.returned_week_1 / s.retention.players_older_7d) * 100)}%`
                : "—"}
              sub={`${s.retention.returned_week_1} of ${s.retention.players_older_7d} players older than a week`}
            />
            <Stat
              label="Returned after a week"
              value={s.retention.players_older_7d > 0
                ? `${Math.round((s.retention.returned_after_7d / s.retention.players_older_7d) * 100)}%`
                : "—"}
              sub={`${s.retention.returned_after_7d} players played 7+ days after joining`}
            />
            <Stat
              label="Played 2+ games"
              value={s.total_players > 0
                ? `${Math.round((s.retention.multi_game_players / s.total_players) * 100)}%`
                : "—"}
              sub={`${s.retention.multi_game_players} of ${s.total_players} players`}
            />
          </div>

          <h2 className="mt-8 font-mono text-xs uppercase tracking-wider text-muted-foreground">Community</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Friendships" value={s.friendships_total} />
            <Stat label="AI analyses run" value={s.analyses_total} />
          </div>
        </>
      )}
    </div>
  );
}
