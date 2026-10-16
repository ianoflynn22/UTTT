import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/use-session";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SoundToggle } from "@/components/SoundToggle";
import { InstallButton } from "@/components/InstallButton";

export function SiteHeader() {
  const user = useUser();
  const navigate = useNavigate();
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("role", "admin").maybeSingle();
      return !!data;
    },
  });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const link = "rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground";
  const active = { className: "text-foreground" };
  const links = (
    <>
      <Link to="/" className={link} activeProps={active} activeOptions={{ exact: true }}>
        Play
      </Link>
      <Link to="/online" className={link} activeProps={active}>
        Online
      </Link>
      <Link to="/puzzle" className={link} activeProps={active}>
        Puzzle
      </Link>
      <Link to="/friends" className={link} activeProps={active}>
        Friends
      </Link>
      <Link to="/history" className={link} activeProps={active}>
        History
      </Link>
      <Link to="/leaderboard" className={link} activeProps={active}>
        Leaderboard
      </Link>
      {user && isAdmin ? (
        <Link to="/admin" className={link} activeProps={active}>
          Stats
        </Link>
      ) : null}
      {user ? (
        <Link to="/profile" className={link} activeProps={active}>
          Profile
        </Link>
      ) : null}
      {user ? (
        <button onClick={signOut} className={`${link} text-left`}>
          Sign out
        </button>
      ) : null}
    </>
  );
  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
        <Link to="/" className="mr-auto shrink-0 font-display text-lg font-bold">
          UTTT<span className="text-player-plus">+</span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">{links}</div>
        <InstallButton />
        <SoundToggle />
        <ThemeToggle />
        {user === null ? (
          <Link
            to="/auth"
            className="ml-1 inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground"
          >
            Sign in
          </Link>
        ) : null}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground md:hidden"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </nav>
      {open && (
        <div className="border-t md:hidden" onClick={() => setOpen(false)}>
          <div className="mx-auto flex max-w-5xl flex-col px-2 py-2">{links}</div>
        </div>
      )}
    </header>
  );
}
