import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CONSENT_KEY, initAnalytics } from "@/lib/analytics";

export function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "yes") initAnalytics().catch(() => {});
    else if (v !== "no") setShow(true);
  }, []);
  if (!show) return null;
  const choose = (v: "yes" | "no") => {
    localStorage.setItem(CONSENT_KEY, v);
    setShow(false);
    if (v === "yes") initAnalytics().catch(() => {});
  };
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-lg border bg-card p-4 text-sm shadow-lg">
      <p className="text-muted-foreground">
        We'd like to use analytics cookies to see how the site is used. Nothing is tracked unless you accept.{" "}
        <Link to="/privacy" className="underline">Privacy policy</Link>
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={() => choose("no")} className="rounded-md border px-3 py-1.5">Decline</button>
        <button onClick={() => choose("yes")} className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground">Accept</button>
      </div>
    </div>
  );
}
