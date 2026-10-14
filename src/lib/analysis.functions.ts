import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { Json } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MODE_INFO, type Mode } from "@/lib/game";

export interface AnalysisTip {
  title: string;
  body: string;
}

export interface GameAnalysis {
  summary: string;
  tips: AnalysisTip[];
}

export const analyzeGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gameId: string }) => input)
  .handler(async ({ data, context }): Promise<{ analysis: GameAnalysis; cached: boolean }> => {
    const { data: g, error } = await context.supabase
      .from("games")
      .select("id, mode, status, winner, player_x, player_o, moves")
      .eq("id", data.gameId)
      .single();
    if (error || !g) throw new Error("Game not found");
    const myRole: "X" | "O" | null = g.player_x === context.userId ? "X" : g.player_o === context.userId ? "O" : null;
    if (!myRole) throw new Error("You are not a player in this game");
    if (g.status !== "finished") throw new Error("Only finished games can be analysed");

    const { data: existing } = await context.supabase
      .from("game_analyses")
      .select("analysis")
      .eq("game_id", g.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing?.analysis) return { analysis: existing.analysis as unknown as GameAnalysis, cached: true };

    const rawMoves: unknown[] = Array.isArray(g.moves) ? g.moves : [];
    const moves = rawMoves.map((m) => {
      const o = (m ?? {}) as { p?: unknown; b?: unknown; c?: unknown };
      return {
        p: o.p === "O" ? "O" : "X",
        b: typeof o.b === "number" ? o.b : 0,
        c: typeof o.c === "number" ? o.c : 0,
      };
    });
    if (moves.length === 0) throw new Error("No recorded moves to analyse");

    const { runGameAnalysis } = await import("@/lib/ai-gateway.server");
    let signal: AbortSignal | undefined;
    try {
      signal = getRequest().signal;
    } catch {
      // No request context available; proceed without cancellation.
    }
    const mode = g.mode as Mode;
    const outcome =
      g.winner === null || g.winner === undefined
        ? "Draw"
        : g.winner === myRole
          ? "You (mark " + myRole + ") won"
          : "Your opponent (mark " + (myRole === "X" ? "O" : "X") + ") won";
    const analysis = await runGameAnalysis({
      modeName: MODE_INFO[mode].name,
      modeRules: MODE_INFO[mode].rules,
      viewerMark: myRole,
      opponentName: "the opponent",
      outcome,
      size: mode === "ttt" || mode === "ultimate" ? 3 : 4,
      moves,
      signal,
    });

    const { error: serr } = await context.supabase.from("game_analyses").insert({ game_id: g.id, user_id: context.userId, mode, analysis: analysis as unknown as Json });
    if (serr) console.error("Failed to save analysis:", serr.message);
    return { analysis, cached: false };
  });
