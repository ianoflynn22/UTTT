import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fromJson, type GameState, type Mode, type Player } from "@/lib/game";

export interface FriendActivity {
  friendId: string;
  online: boolean;
  games: { id: string; mode: Mode }[];
}

export interface WatchedGame {
  id: string; mode: Mode; state: GameState; status: "active" | "finished";
  winner: Player | null; xName: string; oName: string; xCountry: string | null; oCountry: string | null;
}

export const heartbeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("presence_heartbeat");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getFriendActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FriendActivity[]> => {
    const { data, error } = await context.supabase.rpc("friend_activity");
    if (error) throw new Error(error.message);
    return data as unknown as FriendActivity[];
  });

export const watchGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gameId: string }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.gameId)) throw new Error("Invalid game");
    return input;
  })
  .handler(async ({ data, context }): Promise<WatchedGame> => {
    const { data: result, error } = await context.supabase.rpc("watch_friend_game", { _game_id: data.gameId });
    if (error) throw new Error("This game is no longer available to watch.");
    const game = result as unknown as Omit<WatchedGame, "state"> & { state: unknown };
    const state = fromJson(game.mode, game.state);
    if (!state) throw new Error("The board could not be loaded.");
    return { ...game, state };
  });