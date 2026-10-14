import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Privacy Policy — Ultimate Tic-Tac-Toe Plus" },
      { name: "description", content: "What data UTTT+ collects, why, and your rights under GDPR." },
      { property: "og:title", content: "Privacy Policy — Ultimate Tic-Tac-Toe Plus" },
      { property: "og:description", content: "What data UTTT+ collects, why, and your rights under GDPR." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://utttplus.com/privacy" }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="14 October 2026">
      <p>UTTT+ (utttplus.com) is run by Ian O Flynn in Ireland. This page explains what we collect and why.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: email address, username and (optionally) country.</li>
        <li>Game data: online games, moves, results, ratings, friends and challenges.</li>
        <li>AI analysis: moves from games you choose to analyse are sent to an AI model to create tips.</li>
        <li>Analytics (only if you accept cookies): pages visited and events like sign-ups and games played, via Google Analytics.</li>
      </ul>
      <h2>Why</h2>
      <p>To run your account and online play (contract), keep the game fair (legitimate interest), and improve the site (your consent, for analytics).</p>
      <h2>Who sees it</h2>
      <p>Other signed-in players see your username, country, ratings and records. We use service providers to host the site, sign you in (including Google and Apple), run AI analysis and measure traffic. We never sell your data.</p>
      <h2>How long</h2>
      <p>We keep your data while your account exists. Ask us to delete your account and we'll remove your personal data.</p>
      <h2>Your rights</h2>
      <p>You can ask to access, correct, delete or export your data, or withdraw analytics consent at any time (clear cookies on this site). You can also complain to the Irish Data Protection Commission.</p>
      <h2>Contact</h2>
      <p>Email: help@utttplus.com</p>
    </LegalPage>
  );
}
