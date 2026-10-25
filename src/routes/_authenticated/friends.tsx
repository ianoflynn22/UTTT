import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFriendActivity } from "@/lib/friend-activity.functions";
import { track } from "@/lib/analytics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MODE_INFO, type Mode } from "@/lib/game";
import { flag } from "@/lib/countries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/friends")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Friends — Ultimate Tic-Tac-Toe Plus" },
      { name: "description", content: "Add friends, challenge them and keep your head-to-head record." },
      { property: "og:title", content: "Friends — Ultimate Tic-Tac-Toe Plus" },
      { property: "og:description", content: "Add friends, challenge them and keep your head-to-head record." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FriendsPage,
});

interface FriendRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
}

interface ProfileRow {
  id: string;
  username: string;
  country: string | null;
}

interface HistoryRow {
  mode: string;
  player_x: string;
  player_o: string;
  winner: string | null;
}

function FriendsPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("ultimate");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const { data: friendships } = useQuery({
    queryKey: ["friendships", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      if (error) throw error;
      return (data ?? []) as FriendRow[];
    },
    refetchInterval: 6000,
  });

  const incoming = (friendships ?? []).filter((f) => f.status === "pending" && f.addressee_id === user.id);
  const outgoing = (friendships ?? []).filter((f) => f.status === "pending" && f.requester_id === user.id);
  const friends = (friendships ?? []).filter((f) => f.status === "accepted");
  const blocked = (friendships ?? []).filter((f) => f.status === "blocked" && f.requester_id === user.id);
  const activity = useQuery({
    queryKey: ["friend-activity", user.id],
    queryFn: () => getFriendActivity(),
    refetchInterval: 10_000,
  });

  const ids = [
    ...new Set([
      ...friends.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id)),
      ...incoming.map((f) => f.requester_id),
      ...outgoing.map((f) => f.addressee_id),
      ...blocked.map((f) => f.addressee_id),
    ]),
  ];

  const { data: profiles } = useQuery({
    queryKey: ["friend-profiles", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, username, country").in("id", ids);
      if (error) throw error;
      return new Map(((data ?? []) as ProfileRow[]).map((p) => [p.id, p]));
    },
  });

  // Permanent head-to-head record: every finished game against a friend, per mode.
  const { data: history } = useQuery({
    queryKey: ["match-history", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("mode, player_x, player_o, winner")
        .eq("status", "finished")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) return [];
      return (data ?? []) as HistoryRow[];
    },
  });

  const recordFor = (friendId: string) => {
    const rec = new Map<string, { w: number; l: number; d: number }>();
    for (const g of history ?? []) {
      const isMine = g.player_x === user.id || g.player_o === user.id;
      if (!isMine) continue;
      const other = g.player_x === user.id ? g.player_o : g.player_x;
      if (other !== friendId) continue;
      const r = rec.get(g.mode) ?? { w: 0, l: 0, d: 0 };
      if (g.winner === null) r.d++;
      else if ((g.winner === "X") === (g.player_x === user.id)) r.w++;
      else r.l++;
      rec.set(g.mode, r);
    }
    return rec;
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const q = query.trim();
    if (q.length < 2) return setMsg("Type at least 2 characters.");
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, country")
      .ilike("username", `%${q}%`)
      .neq("id", user.id)
      .limit(8);
    if (error) return setMsg(error.message);
    setResults((data ?? []) as ProfileRow[]);
  };

  const addFriend = async (id: string) => {
    const { error } = await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: id });
    if (error) {
      if (error.code === "23505") setMsg("Request already sent.");
      else setMsg(error.message);
      return;
    }
    setMsg("Request sent!");
    setResults((rs) => rs.filter((r) => r.id !== id));
    qc.invalidateQueries({ queryKey: ["friendships", user.id] });
  };

  const accept = async (fid: string) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", fid);
    qc.invalidateQueries({ queryKey: ["friendships", user.id] });
  };

  const remove = async (fid: string) => {
    await supabase.from("friendships").delete().eq("id", fid);
    qc.invalidateQueries({ queryKey: ["friendships", user.id] });
  };

  const block = async (otherId: string) => {
    const { error } = await supabase.rpc("block_user", { _other: otherId });
    if (error) setMsg(error.message);
    qc.invalidateQueries({ queryKey: ["friendships", user.id] });
  };

  const challenge = async (friendId: string) => {
    setMsg(null);
    const { data: gid, error } = await supabase.rpc("challenge_friend", { _friend_id: friendId, _mode: mode });
    if (error) {
      setMsg(error.message.includes("GAME_EXISTS") ? "You already have a game with this friend in this mode." : error.message);
      return;
    }
    track("challenge_send", { mode });
    if (gid) navigate({ to: "/online/$gameId", params: { gameId: gid } });
  };

  const respondChallenge = async (gameId: string, accept: boolean) => {
    await supabase.rpc("respond_challenge", { _game_id: gameId, _accept: accept });
    qc.invalidateQueries({ queryKey: ["online-active-games"] });
    if (accept) navigate({ to: "/online/$gameId", params: { gameId } });
  };

  const { data: challenges } = useQuery({
    queryKey: ["challenges", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("id, mode, status, player_x, player_o, created_by")
        .in("status", ["waiting", "active"])
        .not("player_o", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return (data ?? []) as { id: string; mode: string; status: string; player_x: string; player_o: string; created_by: string | null }[];
    },
    refetchInterval: 5000,
  });

  const modeName = (m: string) => MODE_INFO[m as Mode]?.name ?? m;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Friends</h1>
      <ShareLink />

      <section className="mt-6 rounded-xl border bg-card p-5">
        <p className="font-mono text-xs uppercase text-muted-foreground">Challenge mode</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(MODE_INFO) as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("rounded-full border px-3 py-1 text-sm", m === mode ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>
              {MODE_INFO[m].name}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-xl font-bold">Add friends</h2>
        <form onSubmit={search} className="mt-2 flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username…" className="w-full rounded-md border bg-background px-3 py-2" />
          <button className="rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground">Search</button>
        </form>
        {msg && <p className="mt-2 text-sm text-muted-foreground">{msg}</p>}
        {results.length > 0 && (
          <div className="mt-3 grid gap-2">
            {results.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm">
                <span className="flex-1">{flag(r.country)} {r.username}</span>
                <button onClick={() => addFriend(r.id)} className="rounded-md bg-primary px-3 py-1.5 font-bold text-primary-foreground">Add friend</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {incoming.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xl font-bold">Friend requests</h2>
          <div className="mt-2 grid gap-2">
            {incoming.map((f) => {
              const p = profiles?.get(f.requester_id);
              return (
                <div key={f.id} className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm">
                  <span className="flex-1">{p ? `${flag(p.country)} ${p.username}` : "Player"}</span>
                  <button onClick={() => accept(f.id)} className="rounded-md bg-primary px-3 py-1.5 font-bold text-primary-foreground">Accept</button>
                  <button onClick={() => remove(f.id)} className="rounded-md border px-3 py-1.5 text-sm">Decline</button>
                  <button onClick={() => block(f.requester_id)} className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive">Block</button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xl font-bold">Sent requests</h2>
          <div className="mt-2 grid gap-2">
            {outgoing.map((f) => {
              const p = profiles?.get(f.addressee_id);
              return (
                <div key={f.id} className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm">
                  <span className="flex-1 text-muted-foreground">Waiting… {p ? `${flag(p.country)} ${p.username}` : ""}</span>
                  <button onClick={() => remove(f.id)} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {blocked.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xl font-bold">Blocked</h2>
          <div className="mt-2 grid gap-2">
            {blocked.map((f) => {
              const p = profiles?.get(f.addressee_id);
              return (
                <div key={f.id} className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm">
                  <span className="flex-1 text-muted-foreground">{p ? `${flag(p.country)} ${p.username}` : "Player"}</span>
                  <button onClick={() => remove(f.id)} className="rounded-md border px-3 py-1.5 text-sm">Unblock</button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {friends.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xl font-bold">Your friends</h2>
          <div className="mt-2 grid gap-2">
            {friends.map((f) => {
              const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
              const p = profiles?.get(friendId);
              const rec = recordFor(friendId);
              const live = activity.data?.find((a) => a.friendId === friendId);
              return (
                <div key={f.id} className="rounded-xl border bg-card p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1 break-words font-medium">{p ? `${flag(p.country)} ${p.username}` : "Player"}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", live?.online ? "bg-player-o" : "bg-muted-foreground/40")} />
                      {activity.isError ? "Status unavailable" : !activity.data ? "Checking…" : live?.online ? "Online" : "Offline"}
                    </span>
                    <button onClick={() => challenge(friendId)} className="rounded-md bg-primary px-3 py-1.5 font-bold text-primary-foreground">Challenge</button>
                    <button onClick={() => confirm(`Remove ${p?.username ?? "this friend"}?`) && remove(f.id)} className="rounded-md border px-3 py-1.5 text-sm">Remove</button>
                    <button onClick={() => confirm(`Block ${p?.username ?? "this player"}? They won't be able to send you requests or challenges.`) && block(friendId)} className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive">Block</button>
                  </div>
                  {live && live.games.length > 0 && <div className="mt-3 flex flex-wrap gap-2">
                    {live.games.map((g) => <Button key={g.id} asChild variant="outline" size="sm">
                      <Link to="/watch/$gameId" params={{ gameId: g.id }}><Eye />Watch · {MODE_INFO[g.mode].name}</Link>
                    </Button>)}
                  </div>}
                  {rec.size > 0 && (
                    <p className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      {Object.entries(rec).map(([m, r]) => (
                        <span key={m} className="inline-flex items-baseline gap-1.5">
                          <span className="font-mono text-[10px] uppercase text-muted-foreground">{modeName(m)}</span>
                          <span className="inline-flex items-baseline gap-2">
                            <span className="text-foreground"><span className="font-semibold tabular-nums text-player-o">{r.w}</span><span className="ml-0.5 font-mono text-[10px] uppercase text-muted-foreground">W</span></span>
                            <span><span className="font-semibold tabular-nums text-muted-foreground">{r.d}</span><span className="ml-0.5 font-mono text-[10px] uppercase text-muted-foreground">D</span></span>
                            <span><span className="font-semibold tabular-nums text-destructive">{r.l}</span><span className="ml-0.5 font-mono text-[10px] uppercase text-muted-foreground">L</span></span>
                          </span>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {challenges && challenges.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xl font-bold">Games & challenges</h2>
          <div className="mt-2 grid gap-2">
            {challenges.map((c) => {
              const mine = c.created_by === user.id;
              const other = c.player_x === user.id ? c.player_o : c.player_x;
              const p = other ? profiles?.get(other) : undefined;
              const name = p ? `${flag(p.country)} ${p.username}` : "player";
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 text-sm">
                  <span className="flex-1">
                    {c.status === "active" ? (
                      <>
                        <span className="font-medium">Game vs {name}</span> · <span className="text-muted-foreground">{modeName(c.mode)}</span>
                      </>
                    ) : mine ? (
                      <>
                        Waiting for {name} · <span className="text-muted-foreground">{modeName(c.mode)}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">Challenge from {name}</span> · <span className="text-muted-foreground">{modeName(c.mode)}</span>
                      </>
                    )}
                  </span>
                  {c.status === "active" ? (
                    <button onClick={() => navigate({ to: "/online/$gameId", params: { gameId: c.id } })} className="rounded-md bg-primary px-3 py-1.5 font-bold text-primary-foreground">Enter game</button>
                  ) : mine ? (
                    <button onClick={() => respondChallenge(c.id, false)} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
                  ) : (
                    <>
                      <button onClick={() => respondChallenge(c.id, true)} className="rounded-md bg-primary px-3 py-1.5 font-bold text-primary-foreground">Accept</button>
                      <button onClick={() => respondChallenge(c.id, false)} className="rounded-md border px-3 py-1.5 text-sm">Decline</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-8 text-sm text-muted-foreground">
        <a href="/online" onClick={(e) => { e.preventDefault(); navigate({ to: "/online" }); }} className="text-primary underline">
          Or find a random opponent →
        </a>
      </p>
    </main>
  );
}

function ShareLink() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("ultimate");
  const [err, setErr] = useState<string | null>(null);
  const create = async () => {
    setErr(null);
    const { data: gid, error } = await supabase.rpc("create_lobby", { _mode: mode });
    if (error || !gid) return setErr("Couldn't create the game. Try again.");
    navigate({ to: "/online/$gameId", params: { gameId: gid } });
  };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
      <span className="text-muted-foreground">Share a game link:</span>
      <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="rounded-md border bg-background p-1.5">
        {(Object.keys(MODE_INFO) as Mode[]).map((m) => <option key={m} value={m}>{MODE_INFO[m].name}</option>)}
      </select>
      <button onClick={create} className="ml-auto rounded-md bg-primary px-3 py-1.5 text-primary-foreground">Create link</button>
      {err && <p className="w-full text-destructive">{err}</p>}
    </div>
  );
}
