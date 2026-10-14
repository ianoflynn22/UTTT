import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import appCss from "../styles.css?url";
import { CookieBanner } from "@/components/CookieBanner";
import { AdFooterBanner, AdHeaderBanner, AdInterstitial } from "@/components/AdBanner";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { name: "google-adsense-account", content: "ca-pub-7283981279162493" },
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ultimate Tic-Tac-Toe Plus" },
      { name: "description", content: "Play Ultimate Tic-Tac-Toe and its Plus variants." },
      { name: "theme-color", content: "#0c1120" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", type: "image/png", href: "/icon-192.png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/icon-180.png", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@500;700&family=Space+Grotesk:wght@500;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('uttt-theme')==='light')document.documentElement.classList.add('light')}catch(e){}" }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const FOOTER_LINKS = [
  { to: "/puzzle", label: "Daily puzzle" },
  { to: "/how-to-play", label: "How to play" },
  { to: "/app", label: "Get the app" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "mailto:help@utttplus.com?subject=Bug%20report&body=What%20happened%3A%0A%0AWhat%20I%20expected%3A%0A%0APage%20and%20device%3A%0A", label: "Report a bug" },
] as const;

function FooterRow({ items }: { items: readonly { to: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
      {items.map((item, i) => (
        <span key={item.to} className="whitespace-nowrap">
          {item.to.startsWith("mailto:") ? (
            <a href={item.to} className="hover:text-foreground">{item.label}</a>
          ) : (
            <Link to={item.to} className="hover:text-foreground">
              {item.label}
            </Link>
          )}
          {i < items.length - 1 && <span aria-hidden="true" className="ml-2">·</span>}
        </span>
      ))}
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  // Installable app (PWA): register the service worker.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <SiteHeader />
      <AdHeaderBanner />
      <Outlet />
      <AdFooterBanner />
      <footer className="mx-auto max-w-5xl px-4 py-8 font-mono text-xs text-muted-foreground">
      {/* Mobile: two balanced rows so the last row keeps at least 2 links. */}
      <div className="flex flex-col items-center gap-y-1 sm:hidden">
        <FooterRow items={FOOTER_LINKS.slice(0, 3)} />
        <FooterRow items={FOOTER_LINKS.slice(3)} />
      </div>
      {/* Larger screens: single centered row. */}
      <div className="hidden justify-center sm:flex sm:flex-wrap">
        <FooterRow items={FOOTER_LINKS} />
      </div>
      </footer>
      <AdInterstitial />
      <CookieBanner />
    </QueryClientProvider>
  );
}
