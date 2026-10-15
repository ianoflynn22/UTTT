import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { dateKey } from "@/lib/puzzle";
import { ARCHIVE, ARCHIVE_START } from "./puzzle";

export const Route = createFileRoute("/puzzle_/archive")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Past Daily Puzzles — UTTT+ Archive" },
      { name: "description", content: "Browse and replay every previous Ultimate Tic-Tac-Toe daily puzzle for practice." },
      { property: "og:title", content: "UTTT+ Puzzle Archive" },
      { property: "og:description", content: "Replay every past daily Ultimate Tic-Tac-Toe puzzle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://utttplus.com/og-image.png" },
      { name: "twitter:image", content: "https://utttplus.com/og-image.png" },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const [days, setDays] = useState<string[]>([]);
  const [daily, setDaily] = useState<string[]>([]);
  const [practice, setPractice] = useState<Record<string, number>>({});
  useEffect(() => {
    const list: string[] = [];
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    while (dateKey(d) >= ARCHIVE_START) {
      list.push(dateKey(d));
      d.setUTCDate(d.getUTCDate() - 1);
    }
    setDays(list);
    setDaily(JSON.parse(localStorage.getItem("uttt-puzzle-solved") || "[]"));
    setPractice(JSON.parse(localStorage.getItem(ARCHIVE) || "{}"));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Archive</p>
      <h1 className="mt-2 font-display text-3xl font-bold">Past puzzles</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Replay any previous daily puzzle for practice. Only today's puzzle counts for streaks and leaderboards.{" "}
        <Link to="/puzzle" className="underline hover:text-foreground">Today's puzzle</Link>
      </p>
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {days.length === 0 && <li className="text-sm text-muted-foreground">No past puzzles yet.</li>}
        {days.map((k) => {
          const done = daily.includes(k) || typeof practice[k] === "number";
          return (
            <li key={k}>
              <Link to="/puzzle" search={{ date: k }} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:border-primary">
                <span className="font-mono text-sm">{k}</span>
                <span className={done ? "text-xs text-player-o" : "text-xs text-muted-foreground"}>
                  {done ? `Solved${typeof practice[k] === "number" ? ` · best ${practice[k]}` : ""}` : "Play"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
