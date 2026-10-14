import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkSolution, dailyPuzzle, dateKey } from "@/lib/puzzle";

/** Records a solve only if the line of moves really wins today's (or yesterday's, for timezone edges) puzzle. */
export const submitPuzzleSolve = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { day: string; moves: { b: number; c: number }[]; tries: number }) => i)
  .handler(async ({ data, context }) => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    if (data.day !== dateKey(now) && data.day !== dateKey(yesterday)) throw new Error("Puzzle expired");
    const ok = Array.isArray(data.moves) && data.moves.length <= 60 && checkSolution(dailyPuzzle(data.day).start, data.moves);
    if (!ok) throw new Error("Not a winning move");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const used = data.moves.length;
    const { error } = await supabaseAdmin.rpc("record_puzzle_solve", {
      _user: context.userId,
      _day: data.day,
      _moves: used,
      _tries: Math.max(1, Math.min(99, data.tries | 0)),
    });
    if (error) throw new Error("Could not save your score");
    return { ok: true, moves: used };
  });
