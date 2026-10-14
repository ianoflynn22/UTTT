import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Terms of Use — Ultimate Tic-Tac-Toe Plus" },
      { name: "description", content: "The rules for using UTTT+: accounts, fair play and conduct." },
      { property: "og:title", content: "Terms of Use — Ultimate Tic-Tac-Toe Plus" },
      { property: "og:description", content: "The rules for using UTTT+: accounts, fair play and conduct." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://utttplus.com/terms" }],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Terms of Use" updated="14 October 2026">
      <p>By using UTTT+ you agree to these terms. If you don't agree, please don't use the site.</p>
      <h2>Accounts</h2>
      <p>You must be at least 13 (or the minimum age in your country) to create an account. Keep your login safe; you're responsible for activity on your account.</p>
      <h2>Fair play and conduct</h2>
      <ul>
        <li>No cheating, bots, or exploiting bugs in online games.</li>
        <li>No offensive, hateful or impersonating usernames.</li>
        <li>No harassing other players.</li>
      </ul>
      <p>We may change usernames, reset ratings or remove accounts that break these rules.</p>
      <h2>The service</h2>
      <p>UTTT+ is free and provided "as is". We may change or pause features at any time. AI tips are suggestions and may be wrong.</p>
      <h2>Liability</h2>
      <p>To the extent the law allows, we aren't liable for losses from using the site. Nothing here limits your rights as a consumer under Irish or EU law.</p>
      <h2>Changes and law</h2>
      <p>We may update these terms and will change the date above. Irish law applies.</p>
      <h2>Contact</h2>
      <p>Email: help@utttplus.com</p>
    </LegalPage>
  );
}
