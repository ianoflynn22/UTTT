import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminStats = {
  total_players: number;
  signups_7d: number;
  signups_30d: number;
  games_total: number;
  games_active: number;
  games_finished: number;
  games_7d: number;
  active_players_7d: number;
  games_by_mode: Record<string, number>;
  finished_by_mode: Record<string, number>;
  analyses_total: number;
  friendships_total: number;
  retention: {
    players_older_7d: number;
    returned_week_1: number;
    returned_after_7d: number;
    multi_game_players: number;
  };
};

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStats> => {
    const { data, error } = await context.supabase.rpc("admin_stats");
    if (error) throw new Error(error.message);
    return data as AdminStats;
  });
