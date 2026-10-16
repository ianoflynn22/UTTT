import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_AUDIO, initAudio, loadAudio, playSound, setAudio, type AudioSettings } from "@/lib/sound";

export function SoundToggle() {
  const [s, setS] = useState<AudioSettings>(DEFAULT_AUDIO);
  useEffect(() => { setS(loadAudio()); initAudio(); }, []);
  const update = (patch: Partial<AudioSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    setAudio(next);
  };
  const row = (label: string, k: "master" | "music" | "sfx") => (
    <div key={k} className="space-y-2">
      <div className="flex justify-between font-mono text-xs text-muted-foreground">
        <span>{label}</span><span>{s[k]}%</span>
      </div>
      <Slider
        value={[s[k]]}
        max={100}
        step={1}
        aria-label={label}
        onValueChange={([v]) => update({ [k]: v })}
        onValueCommit={() => k === "sfx" && playSound("capture")}
      />
    </div>
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Sound settings"
          title="Sound settings"
          className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground"
        >
          {s.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Sound</span>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Mute all <Switch checked={s.muted} onCheckedChange={(v) => update({ muted: v })} />
          </label>
        </div>
        {row("Master volume", "master")}
        {row("Background music", "music")}
        {row("Game sounds", "sfx")}
      </PopoverContent>
    </Popover>
  );
}
