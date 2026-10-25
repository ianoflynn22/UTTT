import { useEffect } from "react";
import { useUser } from "@/hooks/use-session";
import { heartbeat } from "@/lib/friend-activity.functions";

export function FriendPresence() {
  const user = useUser();
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    const ping = () => {
      if (!stopped && document.visibilityState === "visible") void heartbeat().catch(() => {});
    };
    ping();
    const timer = window.setInterval(ping, 30_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [userId]);
  return null;
}