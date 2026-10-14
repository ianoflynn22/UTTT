import { createFileRoute, Link } from "@tanstack/react-router";
import { MODE_INFO } from "@/lib/game";

const TITLE = "How to Play Ultimate Tic-Tac-Toe (and the Plus variant) — UTTT+";
const DESC = "Learn the rules of Ultimate Tic-Tac-Toe, Tic-Tac-Toe Plus and Ultimate Plus, with simple strategy tips for beginners.";

export const Route = createFileRoute("/how-to-play")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://utttplus.com/how-to-play" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: "How to Play Ultimate Tic-Tac-Toe", url: "https://utttplus.com/how-to-play" }),
    }],
  }),
  component: HowToPlay,
});

function HowToPlay() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">How to play Ultimate Tic-Tac-Toe</h1>
      <p className="mt-3 text-muted-foreground">
        Ultimate Tic-Tac-Toe is nine tic-tac-toe boards inside one big board. It's quick to learn but needs real strategy. UTTT+ adds the <span className="text-player-plus font-semibold">+</span> twist.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold">The basic rule</h2>
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>X goes first and can play anywhere.</li>
          <li><strong className="text-foreground">Where you play sends your opponent.</strong> If you play in the top-right square of a small board, your opponent must play in the top-right small board.</li>
          <li>Win a small board with three in a row to claim it on the big board.</li>
          <li>If you're sent to a board that's already won or full, you can play on any open board.</li>
          <li>Win three small boards in a row to win the game.</li>
        </ol>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold">The four modes</h2>
        {Object.values(MODE_INFO).map((m) => (
          <div key={m.name} className="rounded-lg border p-4">
            <h3 className="font-semibold">{m.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{m.rules}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold">Beginner strategy tips</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Think about where you send your opponent, not just where you play.</li>
          <li>Avoid sending them to a board where they can win straight away.</li>
          <li>The centre board is powerful, but don't let your opponent get free moves to it.</li>
          <li>Sending someone to a finished board gives them a free choice. Only do it if you have to.</li>
          <li>In Plus modes, a + counts for both players, so watch lines it could complete for either side.</li>
        </ul>
      </section>

      <div className="mt-10 flex gap-3">
        <Link to="/" className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">Play vs computer</Link>
        <Link to="/online" className="rounded-md border px-4 py-2">Play online</Link>
      </div>
    </main>
  );
}
