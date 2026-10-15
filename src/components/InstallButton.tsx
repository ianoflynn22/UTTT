import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// One-tap install: uses the browser's install prompt on Android/desktop; iPhone gets Share → Add to Home Screen tips.
export function InstallButton() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [tip, setTip] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIP);
    };
    window.addEventListener("beforeinstallprompt", h);
    setIos(
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
        !("standalone" in navigator && (navigator as { standalone?: boolean }).standalone),
    );
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!evt && !ios) return null;
  const click = async () => {
    if (evt) {
      await evt.prompt();
      await evt.userChoice;
      setEvt(null);
    } else setTip((t) => !t);
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={click}
        aria-label="Install the app"
        title="Install the app"
        className="ml-1 inline-flex h-9 w-9 sm:w-auto shrink-0 items-center justify-center gap-1.5 rounded-md border sm:px-3 text-sm text-muted-foreground hover:text-foreground"
      >
        <Download className="h-4 w-4" /> <span className="hidden sm:inline">Install</span>
      </button>
      {tip && (
        <p className="absolute right-0 top-11 z-50 w-56 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow">
          Tap the Share button in Safari, then “Add to Home Screen”.
        </p>
      )}
    </div>
  );
}
