import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Deletes the caller's login and personal data. Finished games stay so
 * opponents keep their history; the profile is anonymised to "deleted-user-…".
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const steps = [
      supabaseAdmin.from("game_analyses").delete().eq("user_id", uid),
      supabaseAdmin.from("matchmaking_queue").delete().eq("user_id", uid),
      supabaseAdmin.from("puzzle_solves").delete().eq("user_id", uid),
      supabaseAdmin.from("friendships").delete().or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
      supabaseAdmin.from("ratings").delete().eq("user_id", uid),
      supabaseAdmin.from("user_roles").delete().eq("user_id", uid),
      // Unfinished games/challenges/lobbies have no value to anyone else.
      supabaseAdmin.from("games").delete().in("status", ["waiting", "active"]).or(`player_x.eq.${uid},player_o.eq.${uid}`),
      supabaseAdmin
        .from("profiles")
        .update({ username: `deleted-user-${uid.slice(0, 8)}`, country: null })
        .eq("id", uid),
    ];
    for (const s of steps) {
      const { error } = await s;
      if (error) throw new Error(error.message);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
