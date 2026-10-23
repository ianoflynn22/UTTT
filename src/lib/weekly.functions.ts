import { createServerFn } from "@tanstack/react-start";

export type WeeklyRow = { id: string; username: string; country: string | null; gain: number; wins: number; games: number };

/** Start of the current week (Monday 00:00 UTC). */
export function weekStart(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

/** Rating gained this week in rated (matchmaking) games, per player. Public aggregate only. */
export const getWeeklyLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((d: { mode: string }) => ({ mode: String(d.mode).slice(0, 20) }))
  .handler(async ({ data }): Promise<WeeklyRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: games, error } = await supabaseAdmin
      .from("games")
      .select("player_x, player_o, winner, elo_delta_x, elo_delta_o")
      .eq("mode", data.mode)
      .eq("status", "finished")
      .eq("elo_applied", true)
      .is("created_by", null)
      .gte("updated_at", weekStart().toISOString())
      .limit(5000);
    if (error) throw new Error(error.message);
    const agg = new Map<string, { gain: number; wins: number; games: number }>();
    const add = (id: string | null, delta: number | null, won: boolean) => {
      if (!id) return;
      const r = agg.get(id) ?? { gain: 0, wins: 0, games: 0 };
      r.gain += delta ?? 0;
      r.games += 1;
      if (won) r.wins += 1;
      agg.set(id, r);
    };
    for (const g of games ?? []) {
      add(g.player_x, g.elo_delta_x, g.winner === "X");
      add(g.player_o, g.elo_delta_o, g.winner === "O");
    }
    const ids = [...agg.keys()];
    if (!ids.length) return [];
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, username, country").in("id", ids);
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    return ids
      .map((id) => ({ id, username: byId.get(id)?.username ?? "player", country: byId.get(id)?.country ?? null, ...agg.get(id)! }))
      .filter((r) => !r.username.startsWith("deleted-user-"))
      .sort((a, b) => b.gain - a.gain || b.wins - a.wins)
      .slice(0, 50);
  });
