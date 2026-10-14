import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applyMove, fromJson, isLegal, type GameState, type Mode, type Move, type Player } from "@/lib/game";
import type { Json } from "@/integrations/supabase/types";

export interface OpponentInfo {
  id: string;
  username: string;
  country: string | null;
  elo: number;
}

export interface OnlineGameInfo {
  id: string;
  mode: Mode;
  status: "waiting" | "active" | "finished" | "abandoned";
  state: GameState;
  myRole: Player;
  opponent: OpponentInfo | null;
  myElo: number;
  createdByMe: boolean;
  friendGame: boolean;
  winner: Player | null;
}

export const findMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mode: Mode }) => input)
  .handler(async ({ data, context }) => {
    const { data: gid, error } = await context.supabase.rpc("find_or_create_match", { _mode: data.mode });
    if (error) throw new Error("Could not join the matchmaking queue. Try again.");
    return { gameId: gid ?? null };
  });

export const leaveQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("matchmaking_queue").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const listActiveGames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnlineGameInfo[]> => {
    const { data: games, error } = await context.supabase
      .from("games")
      .select("id, mode, status, player_x, player_o, created_by, winner, state")
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (error || !games) return [];
    const oppIds = [
      ...new Set(
        games
          .map((g) => (g.player_x === context.userId ? g.player_o : g.player_x))
          .filter((v): v is string => Boolean(v)),
      ),
    ];
    if (!oppIds.length) return [];
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, username, country")
      .in("id", oppIds);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return games.map((g) => {
      const myRole: Player = g.player_x === context.userId ? "X" : "O";
      const oppId = myRole === "X" ? g.player_o : g.player_x;
      const opp = oppId ? byId.get(oppId) : undefined;
      return {
        id: g.id,
        mode: g.mode as Mode,
        status: g.status as OnlineGameInfo["status"],
        state: fromJson(g.mode as Mode, g.state) as GameState,
        myElo: 0,
        myRole,
        opponent: opp ? { id: opp.id, username: opp.username, country: opp.country, elo: 0 } : null,
        createdByMe: g.created_by === context.userId,
        friendGame: g.created_by !== null,
        winner: (g.winner as Player | null) ?? null,
      };
    });
  });

export const getGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gameId: string }) => input)
  .handler(async ({ data, context }): Promise<OnlineGameInfo> => {
    const { data: g, error } = await context.supabase.from("games").select("*").eq("id", data.gameId).single();
    if (error || !g) throw new Error("Game not found");
    const myRole: Player | null = g.player_x === context.userId ? "X" : g.player_o === context.userId ? "O" : null;
    if (!myRole) throw new Error("You are not a player in this game");
    const oppId = myRole === "X" ? g.player_o : g.player_x;
    let opponent: OpponentInfo | null = null;
    if (oppId) {
      const [p, r] = await Promise.all([
        context.supabase.from("profiles").select("username, country").eq("id", oppId).single(),
        context.supabase.from("ratings").select("elo").eq("user_id", oppId).eq("mode", g.mode).single(),
      ]);
      if (p.data) opponent = { id: oppId, username: p.data.username, country: p.data.country, elo: r.data?.elo ?? 0 };
    }
    const state = fromJson(g.mode as Mode, g.state) as GameState;
    const [oppId_, myRating] = await Promise.all([
      Promise.resolve(myRole === "X" ? g.player_o : g.player_x),
      context.supabase.from("ratings").select("elo").eq("user_id", context.userId).eq("mode", g.mode).single(),
    ]);
    void oppId_;
    return {
      id: g.id,
      mode: g.mode as Mode,
      status: g.status as OnlineGameInfo["status"],
      state,
      myRole,
      opponent,
      myElo: myRating.data?.elo ?? 0,
      createdByMe: g.created_by === context.userId,
        friendGame: g.created_by !== null,
      winner: (g.winner as Player | null) ?? null,
    };
  });

export const makeMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gameId: string; move: Move }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: g, error } = await context.supabase.from("games").select("*").eq("id", data.gameId).single();
    if (error || !g) throw new Error("Game not found");
    const role: Player | null = g.player_x === context.userId ? "X" : g.player_o === context.userId ? "O" : null;
    if (!role) throw new Error("You are not a player in this game");
    if (g.status !== "active") throw new Error("This game is not in play");
    const state = fromJson(g.mode as Mode, g.state);
    if (!state) throw new Error("Corrupt game state");
    if (state.current !== role) throw new Error("It is not your turn");
    if (!isLegal(state, data.move)) throw new Error("Illegal move");

    // Server-side RNG: both players see the exact same pluses.
    const next = applyMove(state, data.move);
    const finished = next.over;
    const { data: upd, error: uerr } = await supabaseAdmin
      .from("games")
      .update({
        state: next as unknown as Json,
        moves: [...(Array.isArray(g.moves) ? g.moves : []), { p: role, b: data.move.b, c: data.move.c }] as unknown as Json,
        status: finished ? "finished" : "active",
        winner: next.winner,
        move_seq: g.move_seq + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.gameId)
      .eq("move_seq", g.move_seq)
      .select("id");
    if (uerr) throw new Error("Could not save the move. Try again.");
    if (!upd || upd.length === 0) throw new Error("The board changed — refresh and try again.");

    let elos: { x: number; o: number } | null = null;
    if (finished) {
      const { data: e } = await context.supabase.rpc("apply_elo_result", { _game_id: data.gameId });
      if (e) elos = e as { x: number; o: number };
    }
    return { finished, winner: next.winner, elos };
  });

export const resign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gameId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: g } = await context.supabase.from("games").select("*").eq("id", data.gameId).single();
    if (!g) throw new Error("Game not found");
    const role: Player | null = g.player_x === context.userId ? "X" : g.player_o === context.userId ? "O" : null;
    if (!role) throw new Error("You are not a player in this game");
    if (g.status !== "active") throw new Error("This game is not in play");
    const winner: Player = role === "X" ? "O" : "X";
    const { error: uerr } = await supabaseAdmin
      .from("games")
      .update({ status: "finished", winner, updated_at: new Date().toISOString() })
      .eq("id", data.gameId)
      .eq("status", "active");
    if (uerr) throw new Error("Could not resign. Try again.");
    const { data: e } = await context.supabase.rpc("apply_elo_result", { _game_id: data.gameId });
    return { finished: true, winner, elos: (e as { x: number; o: number } | null) ?? null };
  });
