import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "UTTT+ Mobile App — iPhone & Android (Coming Soon)" },
      { name: "description", content: "UTTT+ is coming to the App Store and Google Play. Play Ultimate Tic-Tac-Toe on your phone today by adding the site to your home screen." },
      { property: "og:title", content: "UTTT+ Mobile App — Coming Soon" },
      { property: "og:description", content: "Ultimate Tic-Tac-Toe on iPhone and Android, coming soon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://utttplus.com/app" }],
  }),
  component: AppPage,
});

function StoreBadge({ store, sub }: { store: string; sub: string }) {
  return (
    <div aria-disabled className="relative flex w-56 cursor-not-allowed items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 opacity-80">
      <div className="text-left">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{sub}</div>
        <div className="font-display text-lg font-semibold">{store}</div>
      </div>
      <span className="absolute -right-2 -top-2 rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] uppercase text-primary-foreground">Soon</span>
    </div>
  );
}

function AppPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Mobile app</p>
      <h1 className="mt-2 font-display text-4xl font-bold">UTTT+ is coming to your phone</h1>
      <p className="mt-4 text-muted-foreground">Native apps for iPhone and Android are on the way.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <StoreBadge store="App Store" sub="Coming soon on the" />
        <StoreBadge store="Google Play" sub="Coming soon on" />
      </div>
      <section className="mt-12 rounded-xl border border-border bg-card p-6 text-left text-sm">
        <h2 className="font-display text-lg font-semibold">Play on your phone today</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
          <li><b>iPhone (Safari):</b> tap Share → Add to Home Screen.</li>
          <li><b>Android (Chrome):</b> tap ⋮ → Install app / Add to Home screen.</li>
        </ul>
      </section>
    </main>
  );
}
