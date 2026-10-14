import { createServerFn } from "@tanstack/react-start";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { CONSENT_KEY } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// AdSense publisher + slot IDs are read from server secrets so they can be
// filled in later without code edits. Until the client ID exists (or until the
// visitor accepts cookies), slots render as quiet placeholders and no script
// is loaded — placeholders are static and set no cookies.
export const getAdConfig = createServerFn({ method: "GET" }).handler(async () => ({
  client: process.env["GOOGLE_ADSENSE_CLIENT"] ?? "ca-pub-7283981279162493",
  slotHeader: process.env["GOOGLE_ADSENSE_SLOT_HEADER"] ?? null,
  slotFooter: process.env["GOOGLE_ADSENSE_SLOT_FOOTER"] ?? null,
  slotSide: process.env["GOOGLE_ADSENSE_SLOT_SIDE"] ?? null,
}));

type AdSenseWindow = Window & { adsbygoogle?: unknown[] };

function loadAdSense(client: string) {
  const w = window as AdSenseWindow;
  w.adsbygoogle = w.adsbygoogle || [];
  if (document.querySelector("script[data-adsense]")) return;
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.setAttribute("data-adsense", "1");
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(s);
}

function useAdConfig() {
  const fetchConfig = useServerFn(getAdConfig);
  return useQuery({
    queryKey: ["ad-config"],
    queryFn: () => fetchConfig(),
    staleTime: 5 * 60_000,
  });
}

function AdFrame({
  slotKey,
  className,
  ratioClass,
}: {
  slotKey: "footer" | "header" | "side";
  className?: string;
  ratioClass: string;
}) {
  const { data } = useAdConfig();
  // null until mounted, so SSR and first client render agree on a placeholder.
  const [consented, setConsented] = useState<boolean | null>(null);
  useEffect(() => {
    setConsented(localStorage.getItem(CONSENT_KEY) === "yes");
  }, []);

  const client = data?.client ?? null;
  const slot =
    slotKey === "footer" ? data?.slotFooter : slotKey === "header" ? data?.slotHeader : data?.slotSide;
  const live = !!(client && slot && consented);

  useEffect(() => {
    if (!live) return;
    loadAdSense(client!);
    const w = window as AdSenseWindow;
    (w.adsbygoogle = w.adsbygoogle || []).push({});
  }, [live, client, slot]);

  if (live) {
    return (
      <ins
        className={cn("adsbygoogle block", ratioClass, className)}
        style={{ display: "block" }}
        data-ad-client={client!}
        data-ad-slot={slot!}
        data-full-width-responsive="true"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid place-items-center rounded-lg border border-border/50 bg-card/40",
        ratioClass,
        className,
      )}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
        Advertisement
      </span>
    </div>
  );
}

export function AdHeaderBanner() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-3">
      <AdFrame
        slotKey="header"
        ratioClass="mx-auto h-[100px] max-w-[336px] sm:h-[90px] sm:max-w-[728px]"
        className="w-full"
      />
    </div>
  );
}

const INTERSTITIAL_KEY = "uttt-ad-interstitial";

// Wordle-style once-per-session ad splash: a full-screen page the visitor
// continues past before playing. Shows once per browser session, whether the
// slot is a real ad (once AdSense connects) or the quiet placeholder.
export function AdInterstitial() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(INTERSTITIAL_KEY)) setVisible(true);
    } catch {
      /* storage unavailable — skip */
    }
  }, []);
  if (!visible) return null;
  const close = () => {
    try {
      sessionStorage.setItem(INTERSTITIAL_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-background/95 px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-5">
        <AdFrame slotKey="side" ratioClass="h-[350px] w-full" />
        <p className="text-center text-sm text-muted-foreground">
          Ads keep UTTT+ free to play.
        </p>
        <button
          onClick={close}
          className="rounded-md bg-primary px-8 py-2.5 font-bold text-primary-foreground hover:bg-primary/90"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export function AdFooterBanner() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-2 pt-6">
      <AdFrame
        slotKey="footer"
        ratioClass="mx-auto h-[100px] max-w-[336px] sm:h-[90px] sm:max-w-[728px]"
        className="w-full"
      />
    </div>
  );
}

export function GameAdLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl justify-center gap-4">
      <aside className="hidden w-40 shrink-0 xl:block">
        <div className="sticky top-24">
          <AdFrame slotKey="side" ratioClass="h-[600px] w-full" />
        </div>
      </aside>
      <div className="min-w-0 max-w-5xl flex-1">{children}</div>
      <aside className="hidden w-40 shrink-0 xl:block">
        <div className="sticky top-24">
          <AdFrame slotKey="side" ratioClass="h-[600px] w-full" />
        </div>
      </aside>
    </div>
  );
}
