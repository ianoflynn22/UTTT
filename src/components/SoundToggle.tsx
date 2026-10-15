import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { MUTE_KEY } from "@/lib/sound";

export function SoundToggle() {
  const [muted, setMuted] = useState(false);
  useEffect(() => setMuted(localStorage.getItem(MUTE_KEY) === "1"), []);
  const toggle = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  };
  return (
    <button type="button" onClick={toggle} aria-label={muted ? "Turn sound on" : "Mute sound"} title={muted ? "Sound off" : "Sound on"}
      className="ml-1 shrink-0 rounded-md border p-2 text-muted-foreground hover:text-foreground">
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
