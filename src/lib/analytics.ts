import { createServerFn } from "@tanstack/react-start";

// Measurement IDs are public by design; served from a server secret so it can be changed without code edits.
export const getGaId = createServerFn({ method: "GET" }).handler(async () => {
  return { id: process.env["GOOGLE_ANALYTICS_MEASUREMENT_ID"] ?? null };
});

export const CONSENT_KEY = "uttt-analytics-consent";

type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };

export async function initAnalytics() {
  const w = window as W;
  if (w.gtag) return;
  const { id } = await getGaId();
  if (!id || !/^G-[A-Z0-9]+$/i.test(id)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  w.gtag("set", "developer_id.dZjgwMW", true);
  w.gtag("js", new Date());
  w.gtag("config", id);
}

export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  (window as W).gtag?.("event", event, params);
}
