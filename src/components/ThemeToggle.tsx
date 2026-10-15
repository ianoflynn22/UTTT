import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export const THEME_KEY = "uttt-theme";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);
  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    localStorage.setItem(THEME_KEY, next ? "light" : "dark");
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Dark mode" : "Light mode"}
      className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground"
    >
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
